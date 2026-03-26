import assert from "node:assert/strict";

import { ResultNormalizer } from "../src/loop/result-normalizer.js";
import { RuntimeMetricsCollector } from "../src/runtime/runtime-metrics-collector.js";
import type { AgentContext, AgentRuntimeResult } from "../src/runtime/agent-runtime.js";

export async function runResultNormalizerAndMetricsTests(): Promise<void> {
  await testRuntimeMetricsCollectorUsesLastStepIndex();
  await testResultNormalizerAddsContextAndMetrics();
}

async function testRuntimeMetricsCollectorUsesLastStepIndex(): Promise<void> {
  const collector = new RuntimeMetricsCollector();

  const metrics = collector.summarize({
    status: "success",
    payload: {
      lastStepIndex: 2,
    },
  }, {
    labels: {
      modelLatencyMs: "120",
      inputTokens: "40",
      outputTokens: "8",
    },
  });

  assert.deepEqual(metrics, {
    stepCount: 2,
    modelLatencyMs: 120,
    inputTokens: 40,
    outputTokens: 8,
  });
}

async function testResultNormalizerAddsContextAndMetrics(): Promise<void> {
  const normalizer = new ResultNormalizer();
  const context = createAgentContext();
  const result: AgentRuntimeResult = {
    status: "success",
    payload: {
      content: "{\"summary\":\"ok\"}",
      responseFormat: "json",
      summary: "ok",
      lastStepIndex: 1,
    },
  };

  const normalized = normalizer.normalize(result, context, {
    stepCount: 1,
  });

  assert.equal(normalized.payload.history?.length, 1);
  assert.equal(normalized.payload.metrics?.stepCount, 1);
}

function createAgentContext(): AgentContext {
  return {
    request: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "normalize",
        },
      },
      responseFormat: "json",
    },
    runtimeContext: {
      sessionId: "session-1",
      workdir: "/tmp/agent-runtime",
      history: [
        {
          role: "user",
          content: "{\"task\":\"normalize\"}",
        },
      ],
      memory: [],
      retrievalContext: [],
      mcpToolCalls: [],
    },
  };
}
