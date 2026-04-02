import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { once } from "node:events";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import {
  createAgentApi,
  type AgentEvent,
  type AgentEventListener,
  type IAgent,
} from "../src/interface/agent-api.js";
import type { FetchLike } from "../src/interface/agent-api.js";
import { createTestWorkdir, writeTestLocalEnv } from "./test-workdir.js";

export async function runAgentApiTests(): Promise<void> {
  await testCreateAgentReturnsStableApi();
  await testChatAgentReturnsMockResult();
  await testReactAgentReceivesOnlyAgentScopedEvents();
  await testAgentSubscriptionDeduplicatesAndUnsubscribes();
  await testAgentRegistersExternalMcpTools();
}

async function testCreateAgentReturnsStableApi(): Promise<void> {
  const agentApi = createAgentApi({
    workdir: await createTestWorkdir("agent-runtime-agent-api-stable-"),
  });
  const agent: IAgent = await agentApi.createAgent("chat");

  assert.equal(typeof agent.run, "function");
  assert.equal(typeof agent.subscribeEvents, "function");
  assert.equal(typeof agent.unsubscribeEvents, "function");
}

async function testChatAgentReturnsMockResult(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-agent-api-chat-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const agentApi = createAgentApi({
    workdir,
    defaultModelMode: "real_from_local_env",
    realProviderFetchFn: createProviderFetch(() => "chat agent result"),
  });
  const agent = await agentApi.createAgent("chat");

  const result = await agent.run({
    userInput: {
      task: "what is the response",
    },
  });

  assert.equal(result.errorInfo, undefined);
  assert.equal(result.content, "chat agent result");
  assert.equal(result.format, "text");
}

async function testReactAgentReceivesOnlyAgentScopedEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-agent-api-react-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const agentApi = createAgentApi({
    workdir,
    defaultModelMode: "real_from_local_env",
    realProviderFetchFn: createProviderFetch((prompt) => {
      if (prompt.stage === "react_thought") {
        return JSON.stringify({
          thought: "call the tool",
          actionType: "tool",
          toolCalls: [{ name: "echo_hello", arguments: {} }],
          shouldContinue: false,
          finalAnswer: "react complete",
        });
      }
      if (prompt.stage === "react_observation") {
        return JSON.stringify({
          summary: "react complete",
          completed: true,
          finalAnswer: "react complete",
        });
      }
      throw new Error(`Unexpected stage: ${String(prompt.stage)}`);
    }),
  });
  const agent = await agentApi.createAgent("react");
  const events: AgentEvent[] = [];
  const listener: AgentEventListener = {
    onEvent(event) {
      events.push(event);
    },
  };
  agent.subscribeEvents(listener);

  const result = await agent.run({
    userInput: {
      task: "/react call echo_hello",
    },
  });

  agent.unsubscribeEvents(listener);

  assert.equal(result.errorInfo, undefined);
  assert.equal(result.content, "react complete");
  assert.equal(events.some((event) => event.brief === "react.thought.input"), true);
  assert.equal(events.some((event) => event.brief === "tool.call.started"), true);
  assert.equal(events.some((event) => event.brief.startsWith("runtime.")), false);
}

async function testAgentSubscriptionDeduplicatesAndUnsubscribes(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-agent-api-dedup-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const agentApi = createAgentApi({
    workdir,
    defaultModelMode: "real_from_local_env",
    realProviderFetchFn: createProviderFetch(() => "chat result"),
  });
  const agent = await agentApi.createAgent("chat");
  const events: AgentEvent[] = [];
  const listener: AgentEventListener = {
    onEvent(event) {
      events.push(event);
    },
  };
  agent.subscribeEvents(listener);
  agent.subscribeEvents(listener);

  await agent.run({
    userInput: {
      task: "first call",
    },
  });
  const countBeforeUnsubscribe = events.length;

  agent.unsubscribeEvents(listener);
  agent.unsubscribeEvents(listener);

  await agent.run({
    userInput: {
      task: "second call",
    },
  });

  assert.equal(countBeforeUnsubscribe > 0, true);
  assert.equal(events.length, countBeforeUnsubscribe);
}

async function testAgentRegistersExternalMcpTools(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-agent-api-external-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const endpoint = await startTestMcpHttpServer();
  try {
      const agentApi = createAgentApi({
        workdir,
        externalMcpEndpoints: [endpoint.config],
        defaultModelMode: "real_from_local_env",
      realProviderFetchFn: createProviderFetch((prompt) => {
        if (prompt.stage === "react_thought") {
          return JSON.stringify({
            thought: "use remote tool",
            actionType: "tool",
            toolCalls: [{ name: "remote_echo", arguments: { content: "ok" } }],
            shouldContinue: false,
            finalAnswer: "remote complete",
          });
        }
        if (prompt.stage === "react_observation") {
          return JSON.stringify({
            summary: "remote complete",
            completed: true,
            finalAnswer: "remote complete",
          });
        }
        throw new Error(`Unexpected stage: ${String(prompt.stage)}`);
      }),
    });
    const agent = await agentApi.createAgent("react");
    const events: AgentEvent[] = [];
    const listener: AgentEventListener = {
      onEvent(event) {
        events.push(event);
      },
    };
    agent.subscribeEvents(listener);

    const result = await agent.run({
      userInput: {
        task: "/react call remote tool",
      },
    });

    agent.unsubscribeEvents(listener);

    assert.equal(result.errorInfo, undefined);
    assert.equal(result.content, "remote complete");
    assert.equal(events.some((event) => event.brief === "tool.call.started"), true);
  } finally {
    await endpoint.close();
  }
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
      name: "remote-http",
      url: `http://127.0.0.1:${address.port}/mcp`,
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

function createTestMcpServer(): McpServer {
  const server = new McpServer({
    name: "test-mcp-http",
    version: "1.0.0",
  });
  server.registerTool(
    "remote_echo",
    {
      title: "Remote Echo",
      description: "Echo content from remote MCP test server.",
      inputSchema: {
        content: z.string(),
      },
    },
    async ({ content }) => ({
      content: [{
        type: "text",
        text: `remote:${content}`,
      }],
      structuredContent: {
        content: `remote:${content}`,
      },
    }),
  );
  return server;
}

function createProviderFetch(
  responder: (prompt: Record<string, unknown>) => string,
): FetchLike {
  return async (_url, init) => {
    const parsedBody = JSON.parse(init.body) as {
      messages?: Array<{ role?: string; content?: string }>;
    };
    const userMessage = parsedBody.messages?.find((message) => message.role === "user");
    const prompt = typeof userMessage?.content === "string"
      ? JSON.parse(userMessage.content) as Record<string, unknown>
      : {};
    const content = responder(prompt);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          choices: [{
            message: {
              content,
            },
          }],
        });
      },
    };
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
