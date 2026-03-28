import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  FileStorage,
  InMemoryMcpToolRegistry,
  DefaultMcpGateway,
  DefaultRuntimePermissionPolicy,
  LocalExecutionEnvironment,
  StorageBackedMetrics,
  StorageBackedTrace,
} from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runCapabilityObservabilityP1SrcNewTests(): Promise<void> {
  await testGatewayDispatchAndPolicyBlock();
  await testMetricsAggregateSessionAndTotal();
  await testTracePersistsFlushState();
}

async function testGatewayDispatchAndPolicyBlock(): Promise<void> {
  const registry = new InMemoryMcpToolRegistry({
    echo: {
      async handle(input) {
        return {
          content: String(input.payload.content ?? ""),
          exitCode: 0,
        };
      },
    },
  });
  const gateway = new DefaultMcpGateway(
    new DefaultRuntimePermissionPolicy(["/tmp/allowed"]),
    registry,
    new LocalExecutionEnvironment(),
  );

  const allowed = await gateway.call({
    toolName: "echo",
    payload: { content: "ok" },
    sessionId: "session-1",
    runId: "run-1",
    workingDirectory: "/tmp/allowed",
  });
  const denied = await gateway.call({
    toolName: "echo",
    payload: { content: "deny" },
    sessionId: "session-1",
    runId: "run-1",
    workingDirectory: "/tmp/blocked",
  });

  assert.equal(allowed.content, "ok");
  assert.equal(denied.blockedByPolicy, true);
}

async function testMetricsAggregateSessionAndTotal(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-metrics-");
  const metrics = new StorageBackedMetrics(new FileStorage(path.join(workdir, ".agent_runtime")));

  await metrics.collect({
    sessionId: "session-1",
    result: {
      sessionId: "session-1",
      runId: "run-1",
      content: "ok",
      format: "text",
    },
    providerUsageFacts: {
      promptTokens: 10,
      completionTokens: 5,
    },
    toolExecutionFacts: {
      toolCalls: 1,
      failedToolCalls: 0,
    },
  });
  await metrics.flush();
  const result = await metrics.get("session-1");

  assert.equal(result.sessionMetrics.requestCount, 1);
  assert.equal(result.totalMetrics.toolCallCount, 1);
  assert.equal(result.totalMetrics.tokenUsage.totalTokens, 15);
}

async function testTracePersistsFlushState(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-trace-");
  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const trace = new StorageBackedTrace(storage);

  await trace.record({
    traceId: "trace-1",
    scope: "session",
    eventType: "run_started",
    timestamp: new Date().toISOString(),
    caller: "test",
    summary: "run started",
    sessionId: "session-1",
    runId: "run-1",
  });
  await trace.flush();

  const persisted = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "trace", "events.json"), "utf8"),
  ) as { events?: Array<{ eventType?: string }> };
  assert.equal(persisted.events?.[0]?.eventType, "run_started");
}
