import assert from "node:assert/strict";

import {
  createAgentRuntime,
  type AgentTraceEvent,
  type IAgentTraceRecorder,
} from "../src/runtime/agent-runtime.js";

export async function runTraceRecorderTests(): Promise<void> {
  await testTraceRecorderCapturesSessionLifecycleAndRunEvents();
  await testTraceRecorderCapturesRepairPlanningAsSeparateStartedFact();
  await testTraceRecorderCapturesRequestAndResponseFacts();
  await testTraceRecorderCapturesValidationDecisionFacts();
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
