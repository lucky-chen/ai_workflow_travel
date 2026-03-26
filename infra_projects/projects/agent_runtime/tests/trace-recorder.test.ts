import assert from "node:assert/strict";

import {
  createAgentRuntime,
  type AgentTraceEvent,
  type IAgentTraceRecorder,
} from "../src/runtime/agent-runtime.js";

export async function runTraceRecorderTests(): Promise<void> {
  await testTraceRecorderCapturesSessionLifecycleAndRunEvents();
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
      "plan_generated",
      "execution_finished",
      "observation_finished",
      "run_finished",
      "session_open_requested",
      "session_opened",
      "session_closed",
    ],
  );
  assert.equal(recorder.events[0]?.scope, "sdk");
  assert.equal(recorder.events[2]?.scope, "session");
  assert.equal(recorder.events[2]?.runId, "run-trace-1");
}

class InMemoryAgentTraceRecorder implements IAgentTraceRecorder {
  readonly events: AgentTraceEvent[] = [];

  async record(event: AgentTraceEvent): Promise<void> {
    this.events.push(event);
  }
}
