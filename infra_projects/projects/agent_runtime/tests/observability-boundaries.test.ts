import assert from "node:assert/strict";

import {
  createAgentRuntime,
  type AgentTraceEvent,
  type IAgentTraceRecorder,
} from "../src/runtime/agent-runtime.js";

export async function runObservabilityBoundaryTests(): Promise<void> {
  await testResultMetricsAndTraceDoNotLeakIntoTranscript();
}

async function testResultMetricsAndTraceDoNotLeakIntoTranscript(): Promise<void> {
  const recorder = new InMemoryTraceRecorder();
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
    traceRecorder: recorder,
  });
  const session = await runtime.createSession({
    title: "observability-boundaries",
  });

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "observe",
        },
      },
      responseFormat: "json",
    },
    metadata: {
      requestId: "run-observe-1",
      labels: {
        modelLatencyMs: "25",
      },
    },
  });
  const state = await session.read();

  assert.equal(result.payload.metrics?.modelLatencyMs, 25);
  assert.equal(Array.isArray(result.payload.transcript), true);
  assert.equal(state.transcript.some((turn) => turn.content.includes("modelLatencyMs")), false);
  assert.equal(state.transcript.some((turn) => turn.content.includes("run_started")), false);
  assert.equal(recorder.events.some((event) => event.eventType === "run_started"), true);
}

class InMemoryTraceRecorder implements IAgentTraceRecorder {
  readonly events: AgentTraceEvent[] = [];

  async record(event: AgentTraceEvent): Promise<void> {
    this.events.push(event);
  }
}
