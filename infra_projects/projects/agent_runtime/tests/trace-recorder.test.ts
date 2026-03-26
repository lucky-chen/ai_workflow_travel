import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import {
  createAgentRuntime,
  type AgentTraceEvent,
  type IAgentTraceRecorder,
} from "../src/runtime/agent-runtime.js";
import { FileAgentTraceRecorder } from "../src/runtime/file-agent-trace-recorder.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runTraceRecorderTests(): Promise<void> {
  await testTraceRecorderCapturesSessionLifecycleAndRunEvents();
  await testTraceRecorderCapturesRepairPlanningAsSeparateStartedFact();
  await testTraceRecorderCapturesRequestAndResponseFacts();
  await testTraceRecorderCapturesValidationDecisionFacts();
  await testFileTraceRecorderFlushesAtThresholdWithoutReadingBack();
  await testFileTraceRecorderFlushesOnSessionClosed();
}

async function testTraceRecorderCapturesSessionLifecycleAndRunEvents(): Promise<void> {
  const recorder = new InMemoryAgentTraceRecorder();
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
    traceRecorder: recorder,
  });

  const session = await runtime.createSession({
    title: "trace-session",
  });
  const sessionState = await session.read();

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "trace",
        },
      },
      responseFormat: "json",
    },
    metadata: {
      requestId: "run-trace-1",
      traceId: "trace-1",
    },
  });
  await runtime.openSession({
    sessionId: sessionState.sessionId,
  });
  await runtime.closeSession(sessionState.sessionId);

  assert.deepEqual(
    recorder.events.map((event) => event.eventType),
    [
      "session_create_requested",
      "session_created",
      "run_started",
      "plan_started",
      "plan_generated",
      "execute_started",
      "execution_finished",
      "observe_started",
      "observation_finished",
      "run_finished",
      "session_open_requested",
      "session_opened",
      "session_closed",
    ],
  );
  assert.equal(recorder.events[0]?.scope, "sdk");
  assert.equal(recorder.events[2]?.scope, "session");
  assert.equal(typeof recorder.events[2]?.runId, "string");
  assert.equal(recorder.events[2]?.runId?.startsWith("run-"), true);
  assert.notEqual(recorder.events[2]?.runId, "run-trace-1");
}

class InMemoryAgentTraceRecorder implements IAgentTraceRecorder {
  readonly events: AgentTraceEvent[] = [];

  async record(event: AgentTraceEvent): Promise<void> {
    this.events.push(event);
  }
}

async function testTraceRecorderCapturesRepairPlanningAsSeparateStartedFact(): Promise<void> {
  const recorder = new InMemoryAgentTraceRecorder();
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
    traceRecorder: recorder,
    mockExecute(request) {
      if (request.mode === "planning") {
        const repairPhase = request.prompt.userPrompt.repairPhase;
        return {
          content: JSON.stringify(repairPhase
            ? {
                intent: "chat",
                mode: "direct_generation",
                summary: "repaired",
                stepIndex: 1,
                nextStepGoal: "answer",
                completed: true,
                stopReason: "completed",
              }
            : {
                intent: "chat",
                mode: "direct_generation",
                summary: "",
                stepIndex: 1,
                nextStepGoal: "",
              }),
          responseFormat: "json",
        };
      }

      return {
        content: "{\"answer\":\"ok\"}",
        responseFormat: "json",
      };
    },
  });
  const session = await runtime.createSession({});

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "repair trace",
        },
      },
      responseFormat: "json",
    },
  });

  assert.equal(recorder.events.filter((event) => event.eventType === "plan_started").length, 2);
  assert.equal(recorder.events.filter((event) => event.eventType === "plan_generated").length, 2);
}

async function testTraceRecorderCapturesRequestAndResponseFacts(): Promise<void> {
  const recorder = new InMemoryAgentTraceRecorder();
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
    traceRecorder: recorder,
  });
  const session = await runtime.createSession({});

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "need trace facts",
        },
      },
      responseFormat: "json",
    },
  });

  const planGenerated = recorder.events.find((event) => event.eventType === "plan_generated");
  const executionFinished = recorder.events.find((event) => event.eventType === "execution_finished");

  assert.equal(planGenerated?.payload?.requestType, "planning");
  assert.equal(typeof planGenerated?.payload?.requestBodyPreview, "object");
  assert.equal(typeof planGenerated?.payload?.parsedContentPreview, "object");
  assert.equal(executionFinished?.payload?.requestType, "execution");
  assert.equal(typeof executionFinished?.payload?.rawResponsePreview, "object");
  assert.equal(typeof executionFinished?.payload?.parsedContentPreview, "object");
}

async function testTraceRecorderCapturesValidationDecisionFacts(): Promise<void> {
  const recorder = new InMemoryAgentTraceRecorder();
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
    traceRecorder: recorder,
    mockExecute(request) {
      if (request.mode === "planning") {
        return {
          content: JSON.stringify({
            intent: "chat",
            mode: "direct_generation",
            summary: "bad plan",
            stepIndex: 1,
            nextStepGoal: "",
          }),
          responseFormat: "json",
        };
      }

      return {
        content: "{\"answer\":\"unused\"}",
        responseFormat: "json",
      };
    },
  });
  const session = await runtime.createSession({});

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "validation trace facts",
        },
      },
      responseFormat: "json",
    },
  });

  const validationFailed = recorder.events.find((event) => event.eventType === "validation_failed");
  assert.equal(validationFailed?.payload?.phase, "plan");
  assert.equal(validationFailed?.payload?.action, "fail");
  assert.equal(validationFailed?.payload?.stepIndex, 1);
}

async function testFileTraceRecorderFlushesAtThresholdWithoutReadingBack(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-trace-file-");
  const tracePath = path.join(workdir, "dist", "agent-runtime-trace-test.json");
  const recorder = new FileAgentTraceRecorder(tracePath, 3);

  await recorder.record(createSdkEvent("session_create_requested"));
  await assertFileMissing(tracePath);

  await recorder.record(createSdkEvent("session_created", "session-1"));
  await assertFileMissing(tracePath);

  await recorder.record(createRunEvent("run_started", "session-1", "run-1"));

  const traceEvents = JSON.parse(await readFile(tracePath, "utf8")) as AgentTraceEvent[];
  assert.equal(traceEvents.length, 3);
  assert.deepEqual(
    traceEvents.map((event) => event.eventType),
    ["session_create_requested", "session_created", "run_started"],
  );
}

async function testFileTraceRecorderFlushesOnSessionClosed(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-trace-close-");
  const tracePath = path.join(workdir, "dist", "agent-runtime-trace-test.json");
  const recorder = new FileAgentTraceRecorder(tracePath, 10);

  await recorder.record(createSdkEvent("session_create_requested"));
  await recorder.record(createSdkEvent("session_created", "session-2"));
  await assertFileMissing(tracePath);

  await recorder.record(createSdkEvent("session_closed", "session-2"));

  const traceEvents = JSON.parse(await readFile(tracePath, "utf8")) as AgentTraceEvent[];
  assert.deepEqual(
    traceEvents.map((event) => event.eventType),
    ["session_create_requested", "session_created", "session_closed"],
  );
}

async function assertFileMissing(filePath: string): Promise<void> {
  await assert.rejects(() => access(filePath));
}

function createSdkEvent(
  eventType: "session_create_requested" | "session_created" | "session_closed",
  sessionId?: string,
): AgentTraceEvent {
  return {
    scope: "sdk",
    eventType,
    traceId: "trace-test",
    timestamp: new Date().toISOString(),
    caller: "trace-test",
    summary: eventType,
    ...(sessionId ? { sessionId } : {}),
  };
}

function createRunEvent(
  eventType: "run_started",
  sessionId: string,
  runId: string,
): AgentTraceEvent {
  return {
    scope: "session",
    eventType,
    sessionId,
    runId,
    traceId: runId,
    timestamp: new Date().toISOString(),
    caller: "trace-test",
    summary: eventType,
  };
}
