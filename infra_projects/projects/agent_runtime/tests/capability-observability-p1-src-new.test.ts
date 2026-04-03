import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AddressInfo } from "node:net";
import { once } from "node:events";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { createSessionApi } from "../src/interface/api.js";
import { FileStorage } from "../src/data/storage.js";
import { McpGateway } from "../src/capability/mcp-gateway.js";
import { RuntimePermissionPolicy } from "../src/capability/permission-policy.js";
import { ExecutionEnvironment } from "../src/capability/execution-environment.js";
import { McpToolRegistry } from "../src/capability/tool-registry.js";
import { registerExternalMcpEndpoints } from "../src/capability/external_mcp_tool_adapter.js";
import type { ToolCallInput } from "../src/capability/types.js";
import type { SessionEvent } from "../src/interface/api.js";
import { createMetrics } from "../src/observability/metrics.js";
import { createTrace, type Trace } from "../src/observability/trace.js";
import { mapSessionEventToTraceEvents } from "../src/observability/trace_event_mapper.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runCapabilityObservabilityP1SrcNewTests(): Promise<void> {
  await testSessionEventWritesTraceAndCallback();
  await testGatewayDispatchAndPolicyBlock();
  await testExternalMcpToolAdapterRegistersRemoteTools();
  await testRuntimeRegistersExternalMcpTools();
  await testMetricsAggregateSessionAndTotal();
  await testMetricsAutoFlushesAfterThresholdAndToolUsage();
  await testTracePersistsFlushState();
  await testTraceAutoFlushesAfterThresholdAndTerminalEvents();
}

async function testSessionEventWritesTraceAndCallback(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-event-bus-");
  const trace = createTrace(new FileStorage(path.join(workdir, ".agent_runtime")), "event-bus");
  const received: SessionEvent[] = [];
  const event: SessionEvent = {
    brief: "run_started",
    sessionId: "session-1",
    traceId: "trace-1",
    timestamp: new Date().toISOString(),
  };

  for (const traceEvent of mapSessionEventToTraceEvents(event)) {
    await trace.record(traceEvent);
  }
  received.push(event);
  await trace.flush();

  assert.equal(received.length, 1);
  const persisted = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "traces", "trace_event-bus.json"), "utf8"),
  ) as { events?: Array<{ type?: string; brief?: string; details?: Record<string, unknown> }> };
  assert.equal(persisted.events?.[0]?.type, "session");
  assert.equal(persisted.events?.[0]?.brief, "run_started");
  assert.equal(persisted.events?.[0]?.details?.sessionId, "session-1");
}

async function testGatewayDispatchAndPolicyBlock(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-gateway-");
  const echoHandler = {
    handle(input: ToolCallInput) {
      return Promise.resolve({
        content: typeof input.arguments.content === "string" ? input.arguments.content : "",
        exitCode: 0,
      });
    },
  };
  const registry = new McpToolRegistry([
    {
      name: "echo",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string" },
        },
      },
      handler: echoHandler,
    },
  ]);
  const allowedTrace = createTrace(new FileStorage(path.join(workdir, ".agent_runtime")), "gateway-allowed");
  const blockedTrace = createTrace(new FileStorage(path.join(workdir, ".agent_runtime")), "gateway-blocked");
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
    events?: Array<{ brief?: string; details?: Record<string, unknown> }>;
  };
  const blockedEvent = blockedPersisted.events?.find((event) => event.brief === "tool.call.failed");
  assert.equal(Boolean(blockedEvent), true);
  assert.equal(blockedEvent?.details?.toolName, "echo");
  assert.deepEqual(blockedEvent?.details?.arguments, { keys: ["content"] });
}

async function testExternalMcpToolAdapterRegistersRemoteTools(): Promise<void> {
  const registry = new McpToolRegistry();
  const endpoint = await startTestMcpHttpServer();
  try {
    await registerExternalMcpEndpoints(registry, [endpoint.config]);

    const handler = registry.resolve("remote_echo");
    const definitions = registry.listToolDefinitions();
    const result = await handler.handle({
      toolCallId: "remote-1",
      toolName: "remote_echo",
      arguments: { content: "ok" },
    });

    assert.equal(result.content, "remote:ok");
    assert.equal(definitions.some((definition) => definition.name === "remote_echo" && Boolean(definition.inputSchema)), true);
  } finally {
    await endpoint.close();
  }
}

async function testRuntimeRegistersExternalMcpTools(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-external-mcp-");
  const endpoint = await startTestMcpHttpServer();
  try {
    const runtime = createSessionApi({
      workdir,
      externalMcpEndpoints: [endpoint.config],
    });
    const session = await runtime.createSession({
      config: {
        model: {
          mock: true,
          mockInfo: {
            content: "{\"thought\":\"use tool\",\"actionType\":\"tool\",\"toolCalls\":[{\"name\":\"remote_echo\",\"arguments\":{\"content\":\"from runtime\"}}],\"shouldContinue\":false,\"finalAnswer\":\"done\"}",
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
      state.history.at(-1)?.content,
      "done",
    );
    assert.equal(
      state.history.some((item) => item.role === "assistant" && item.content === "done"),
      true,
    );
  } finally {
    await endpoint.close();
  }
}

async function testMetricsAggregateSessionAndTotal(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-metrics-");
  const metrics = createMetrics(new FileStorage(path.join(workdir, ".agent_runtime")));

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
  const metrics = createMetrics(new FileStorage(path.join(workdir, ".agent_runtime")));

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

  const metricsWithToolUsage = createMetrics(new FileStorage(path.join(workdir, ".agent_runtime")));
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
  const trace = createTrace(storage, "trace-persist");

  await trace.record({
    type: "session",
    brief: "run_started",
    details: {
      sessionId: "session-1",
    },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
  await trace.flush();

  const persisted = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "traces", "trace_trace-persist.json"), "utf8"),
  ) as { events?: Array<{ brief?: string }> };
  assert.equal(persisted.events?.[0]?.brief, "run_started");
}

async function testTraceAutoFlushesAfterThresholdAndTerminalEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-trace-autoflush-");
  const tracePath = path.join(workdir, ".agent_runtime", "traces", "trace_trace-autoflush.json");
  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const trace = createTrace(storage, "trace-autoflush");

  await trace.record(createTraceEvent("run_started"));
  await assertRejectsFileRead(tracePath);

  await trace.record(createTraceEvent("context_assembled"));
  await assertRejectsFileRead(tracePath);

  await trace.record(createTraceEvent("react.thought.input"));
  const thresholdPersisted = JSON.parse(await readFile(tracePath, "utf8")) as {
    events?: Array<{ brief?: string }>;
  };
  assert.deepEqual(
    (thresholdPersisted.events ?? []).map((event) => event.brief),
    ["run_started", "context_assembled", "react.thought.input"],
  );

  const terminalTrace = createTrace(storage, "trace-autoflush");
  await terminalTrace.record(createTraceEvent("run_finished"));
  const terminalPersisted = JSON.parse(await readFile(tracePath, "utf8")) as {
    events?: Array<{ brief?: string }>;
  };
  assert.equal(terminalPersisted.events?.at(-1)?.brief, "run_finished");
}

function createTraceEvent(brief: string): Parameters<Trace["record"]>[0] {
  return {
    type: brief.startsWith("react.") ? "agent" : "session",
    brief,
    details: {
      sessionId: "session-1",
    },
    metadata: {
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
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
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
      void server.close();
    }
    })();
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
    ({ content }) => Promise.resolve({
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
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }
    throw new Error("Unexpected request chunk type.");
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
