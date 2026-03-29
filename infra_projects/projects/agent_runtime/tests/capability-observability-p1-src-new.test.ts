import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { AddressInfo } from "node:net";
import { once } from "node:events";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import {
  FileStorage,
  McpToolRegistry,
  McpGateway,
  RuntimePermissionPolicy,
  ExecutionEnvironment,
  Metrics,
  Trace,
  createRuntime,
  registerExternalMcpEndpoints,
  type ToolCallInput,
} from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runCapabilityObservabilityP1SrcNewTests(): Promise<void> {
  await testGatewayDispatchAndPolicyBlock();
  await testExternalMcpToolAdapterRegistersRemoteTools();
  await testRuntimeRegistersExternalMcpTools();
  await testMetricsAggregateSessionAndTotal();
  await testMetricsAutoFlushesAfterThresholdAndToolUsage();
  await testTracePersistsFlushState();
  await testTraceAutoFlushesAfterThresholdAndTerminalEvents();
}

async function testGatewayDispatchAndPolicyBlock(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-gateway-");
  const registry = new McpToolRegistry([
    {
      name: "echo",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string" },
        },
      },
      handler: {
        async handle(input: ToolCallInput) {
          return {
            content: String(input.arguments.content ?? ""),
            exitCode: 0,
          };
        },
      },
    },
  ]);
  const allowedTrace = new Trace(new FileStorage(path.join(workdir, ".agent_runtime")), "gateway-allowed");
  const blockedTrace = new Trace(new FileStorage(path.join(workdir, ".agent_runtime")), "gateway-blocked");
  const gateway = new McpGateway(
    new RuntimePermissionPolicy("/tmp/allowed", ["/tmp/allowed"]),
    registry,
    new ExecutionEnvironment(),
    allowedTrace,
  );
  const blockedGateway = new McpGateway(
    new RuntimePermissionPolicy("/tmp/blocked", ["/tmp/allowed"]),
    registry,
    new ExecutionEnvironment(),
    blockedTrace,
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
  await blockedTrace.flush();
  const blockedPersisted = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "traces", "trace_gateway-blocked.json"), "utf8"),
  ) as {
    events?: Array<{ eventType?: string; payload?: Record<string, unknown> }>;
  };
  const blockedEvent = blockedPersisted.events?.find((event) => event.eventType === "tool_result_recorded");
  assert.equal(Boolean(blockedEvent), true);
  assert.equal(blockedEvent?.payload?.toolName, "echo");
  assert.deepEqual(blockedEvent?.payload?.arguments, { content: "deny" });
}

async function testExternalMcpToolAdapterRegistersRemoteTools(): Promise<void> {
  const registry = new McpToolRegistry();
  const workdir = await createTestWorkdir("agent-runtime-p1-external-mcp-trace-");
  const trace = new Trace(new FileStorage(path.join(workdir, ".agent_runtime")), "external-mcp-register");
  const endpoint = await startTestMcpHttpServer();
  try {
    await registerExternalMcpEndpoints(registry, [endpoint.config], trace);

    const handler = await registry.resolve("remote_echo");
    const definitions = await registry.listToolDefinitions();
    const result = await handler.handle({
      toolCallId: "remote-1",
      toolName: "remote_echo",
      arguments: { content: "ok" },
    });

    assert.equal(result.content, "remote:ok");
    assert.equal(definitions.some((definition) => definition.name === "remote_echo" && Boolean(definition.inputSchema)), true);
    await trace.flush();
    const persisted = JSON.parse(
      await readFile(path.join(workdir, ".agent_runtime", "traces", "trace_external-mcp-register.json"), "utf8"),
    ) as { events?: Array<{ eventType?: string; payload?: Record<string, unknown> }> };
    const registrationEvent = persisted.events?.find((event) => event.eventType === "external_mcp_registered");
    assert.equal(Boolean(registrationEvent), true);
    assert.equal(registrationEvent?.payload?.endpointCount, 1);
    assert.equal(registrationEvent?.payload?.toolCount, 1);
    assert.equal(Array.isArray(registrationEvent?.payload?.endpoints), true);
  } finally {
    await endpoint.close();
  }
}

async function testRuntimeRegistersExternalMcpTools(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-external-mcp-");
  const endpoint = await startTestMcpHttpServer();
  try {
    const runtime = createRuntime({
      workdir,
      externalMcpEndpoints: [endpoint.config],
    });
    const session = await runtime.createSession({
      config: {
        model: {
          mock: true,
          mockInfo: {
            content: "{\"thought\":\"use tool\",\"actionType\":\"tool\",\"toolName\":\"remote_echo\",\"actionPayload\":{\"content\":\"from runtime\"},\"shouldContinue\":false,\"finalAnswer\":\"done\"}",
          },
        },
      },
    });

    const result = await session.execute({
      content: {
        task: "/react call remote tool",
      },
    });

    assert.equal(result.errorCode, undefined);
    const state = await session.load();
    assert.equal(
      state.history.some((item) => item.role === "tool" && item.content.includes("remote:from runtime")),
      true,
    );
  } finally {
    await endpoint.close();
  }
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
    scope: "session",
    eventType: "run_started",
    sessionId: "session-1",
    metadata: {
      traceId: "trace-1",
      timestamp: new Date().toISOString(),
    },
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
    scope: "session" as const,
    eventType,
    sessionId: "session-1",
    payload: eventType === "agent_selected" ? { agent: "react" } : undefined,
    metadata: {
      traceId: `${eventType}-trace`,
      timestamp: new Date().toISOString(),
    },
  };
}

async function assertRejectsFileRead(filePath: string): Promise<void> {
  await assert.rejects(() => readFile(filePath, "utf8"));
}

async function startTestMcpHttpServer(): Promise<{
  config: { name: string; url: string };
  close(): Promise<void>;
}> {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }));
      return;
    }

    const server = createTestMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);

    try {
      const body = await readJsonBody(req);
      await transport.handleRequest(req, res, body);
    } finally {
      await transport.close();
      server.close();
    }
  });
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const address = httpServer.address() as AddressInfo;

  return {
    config: {
      name: "test-http-mcp",
      url: `http://127.0.0.1:${address.port}/mcp`,
    },
    async close() {
      httpServer.close();
      await once(httpServer, "close");
    },
  };
}

function createTestMcpServer(): McpServer {
  const server = new McpServer({
    name: "agent-runtime-test-mcp-server",
    version: "0.1.0",
  });
  server.registerTool(
    "remote_echo",
    {
      description: "Echo content from the external MCP server.",
      inputSchema: {
        content: z.string().optional(),
      },
    },
    async ({ content }) => ({
      content: [
        {
          type: "text",
          text: `remote:${content ?? ""}`,
        },
      ],
    }),
  );
  return server;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
