import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  FileStorage,
  McpToolRegistry,
  McpGateway,
  RuntimePermissionPolicy,
  ExecutionEnvironment,
  Metrics,
  Trace,
  type ToolCallInput,
} from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runCapabilityObservabilityP1SrcNewTests(): Promise<void> {
  await testGatewayDispatchAndPolicyBlock();
  await testMetricsAggregateSessionAndTotal();
  await testMetricsAutoFlushesAfterThresholdAndToolUsage();
  await testTracePersistsFlushState();
  await testTraceAutoFlushesAfterThresholdAndTerminalEvents();
}

async function testGatewayDispatchAndPolicyBlock(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-gateway-");
  const registry = new McpToolRegistry({
    echo: {
      async handle(input: ToolCallInput) {
        return {
          content: String(input.arguments.content ?? ""),
          exitCode: 0,
        };
      },
    },
  });
  const gateway = new McpGateway(
    new RuntimePermissionPolicy("/tmp/allowed", ["/tmp/allowed"]),
    registry,
    new ExecutionEnvironment(),
    new Trace(new FileStorage(path.join(workdir, ".agent_runtime")), "gateway-allowed"),
  );
  const blockedGateway = new McpGateway(
    new RuntimePermissionPolicy("/tmp/blocked", ["/tmp/allowed"]),
    registry,
    new ExecutionEnvironment(),
    new Trace(new FileStorage(path.join(workdir, ".agent_runtime")), "gateway-blocked"),
  );

  const allowed = await gateway.call({
    toolCallId: "tool-1",
    toolName: "echo",
    arguments: { content: "ok" },
  });
  const denied = await blockedGateway.call({
    toolCallId: "tool-2",
    toolName: "echo",
    arguments: { content: "deny" },
  });

  assert.equal(allowed.content, "ok");
  assert.equal(denied.blockedByPolicy, true);
}

async function testMetricsAggregateSessionAndTotal(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-metrics-");
  const metrics = new Metrics(new FileStorage(path.join(workdir, ".agent_runtime")));

  await metrics.collect({
    sessionId: "session-1",
    result: {
      sessionId: "session-1",
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

async function testMetricsAutoFlushesAfterThresholdAndToolUsage(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-metrics-autoflush-");
  const metricsPath = path.join(workdir, ".agent_runtime", "metrics", "summary.json");
  const metrics = new Metrics(new FileStorage(path.join(workdir, ".agent_runtime")));

  await metrics.collect({
    sessionId: "session-1",
    result: {
      sessionId: "session-1",
      content: "ok-1",
      format: "text",
    },
    toolExecutionFacts: {
      toolCalls: 0,
      failedToolCalls: 0,
    },
  });
  await assertRejectsFileRead(metricsPath);

  await metrics.collect({
    sessionId: "session-1",
    result: {
      sessionId: "session-1",
      content: "ok-2",
      format: "text",
    },
    toolExecutionFacts: {
      toolCalls: 0,
      failedToolCalls: 0,
    },
  });
  await assertRejectsFileRead(metricsPath);

  await metrics.collect({
    sessionId: "session-1",
    result: {
      sessionId: "session-1",
      content: "ok-3",
      format: "text",
    },
    toolExecutionFacts: {
      toolCalls: 0,
      failedToolCalls: 0,
    },
  });

  const thresholdPersisted = JSON.parse(await readFile(metricsPath, "utf8")) as {
    total?: { requestCount?: number };
  };
  assert.equal(thresholdPersisted.total?.requestCount, 3);

  const metricsWithToolUsage = new Metrics(new FileStorage(path.join(workdir, ".agent_runtime")));
  await metricsWithToolUsage.collect({
    sessionId: "session-2",
    result: {
      sessionId: "session-2",
      content: "ok-4",
      format: "text",
    },
    toolExecutionFacts: {
      toolCalls: 1,
      failedToolCalls: 0,
    },
  });

  const toolPersisted = JSON.parse(await readFile(metricsPath, "utf8")) as {
    sessions?: Record<string, { toolCallCount?: number }>;
  };
  assert.equal(toolPersisted.sessions?.["session-2"]?.toolCallCount, 1);
}

async function testTracePersistsFlushState(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-trace-");
  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const trace = new Trace(storage, "trace-persist");

  await trace.record({
    traceId: "trace-1",
    scope: "session",
    eventType: "run_started",
    timestamp: new Date().toISOString(),
    summary: "run started",
    sessionId: "session-1",
  });
  await trace.flush();

  const persisted = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "traces", "trace_trace-persist.json"), "utf8"),
  ) as { events?: Array<{ eventType?: string }> };
  assert.equal(persisted.events?.[0]?.eventType, "run_started");
}

async function testTraceAutoFlushesAfterThresholdAndTerminalEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-trace-autoflush-");
  const tracePath = path.join(workdir, ".agent_runtime", "traces", "trace_trace-autoflush.json");
  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const trace = new Trace(storage, "trace-autoflush");

  await trace.record(createTraceEvent("run_started"));
  await assertRejectsFileRead(tracePath);

  await trace.record(createTraceEvent("context_assembled"));
  await assertRejectsFileRead(tracePath);

  await trace.record(createTraceEvent("agent_selected"));
  const thresholdPersisted = JSON.parse(await readFile(tracePath, "utf8")) as {
    events?: Array<{ eventType?: string }>;
  };
  assert.deepEqual(
    (thresholdPersisted.events ?? []).map((event) => event.eventType),
    ["run_started", "context_assembled", "agent_selected"],
  );

  const terminalTrace = new Trace(storage, "trace-autoflush");
  await terminalTrace.record(createTraceEvent("run_finished"));
  const terminalPersisted = JSON.parse(await readFile(tracePath, "utf8")) as {
    events?: Array<{ eventType?: string }>;
  };
  assert.equal(terminalPersisted.events?.at(-1)?.eventType, "run_finished");
}

function createTraceEvent(eventType: Parameters<Trace["record"]>[0]["eventType"]) {
  return {
    traceId: `${eventType}-trace`,
    scope: "session" as const,
    eventType,
    timestamp: new Date().toISOString(),
    summary: eventType,
    sessionId: "session-1",
  };
}

async function assertRejectsFileRead(filePath: string): Promise<void> {
  await assert.rejects(() => readFile(filePath, "utf8"));
}
