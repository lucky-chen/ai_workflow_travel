import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { runTerminalSessionCli } from "../bin/terminal-session-demo.js";
import { createRuntime, type FetchLike } from "../src_new/interface/api.js";
import { WorkspaceLocalEnv } from "../src_new/runtime/workspace-local-env.js";
import { createTestWorkdir, writeTestLocalEnv } from "./test-workdir.js";

export async function runRealProviderP1SrcNewTests(): Promise<void> {
  await testLoadRequiredRealProviderConfig();
  await testExtractConfigsFromLoadedLocalEnv();
  await testLoadExternalMcpEndpointConfigsExpandsWorkdir();
  await testLoadRequiredRealProviderConfigFailsWhenMissing();
  await testRuntimeUsesRealProviderModeFromLocalEnv();
  await testRuntimeLoadsExternalMcpServersFromLocalEnv();
  await testTerminalCliUsesRealProviderRuntimePath();
}

async function testLoadRequiredRealProviderConfig(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-load-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    apiKey: "deepseek-key",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    timeoutMs: 10000,
  });

  const workspaceLocalEnv = new WorkspaceLocalEnv(workdir);
  const loaded = await workspaceLocalEnv.load();
  const config = workspaceLocalEnv.getRequiredRealProviderConfig(loaded!);
  assert.equal(config.provider, "deepseek");
  assert.equal(config.apiKey, "deepseek-key");
  assert.equal(config.baseUrl, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(config.model, "deepseek-chat");
}

async function testExtractConfigsFromLoadedLocalEnv(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-local-env-loaded-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    apiKey: "deepseek-key",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    externalMcpEndpoints: [
      {
        name: "filesystem",
        url: "http://127.0.0.1:3333/${workdir}",
      },
    ],
  });

  const workspaceLocalEnv = new WorkspaceLocalEnv(workdir);
  const loaded = await workspaceLocalEnv.load();

  assert.equal(Boolean(loaded), true);
  const realProvider = workspaceLocalEnv.getRequiredRealProviderConfig(loaded!);
  const externalMcpEndpoints = workspaceLocalEnv.getExternalMcpEndpointConfigs(loaded);
  assert.equal(realProvider.provider, "deepseek");
  assert.equal(externalMcpEndpoints[0]?.url, `http://127.0.0.1:3333/${workdir}`);
}

async function testLoadExternalMcpEndpointConfigsExpandsWorkdir(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-mcp-config-");
  await writeTestLocalEnv(workdir, {
    externalMcpEndpoints: [
      {
        name: "filesystem",
        url: "http://127.0.0.1:3333/${workdir}",
        headers: {
          Authorization: "Bearer ${workdir}",
        },
      },
    ],
  });

  const workspaceLocalEnv = new WorkspaceLocalEnv(workdir);
  const loaded = await workspaceLocalEnv.load({ optional: true });
  const endpoints = workspaceLocalEnv.getExternalMcpEndpointConfigs(loaded);

  assert.equal(endpoints.length, 1);
  assert.equal(endpoints[0]?.url, `http://127.0.0.1:3333/${workdir}`);
  assert.equal(endpoints[0]?.headers?.Authorization, `Bearer ${workdir}`);
}

async function testLoadRequiredRealProviderConfigFailsWhenMissing(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-missing-");
  const workspaceLocalEnv = new WorkspaceLocalEnv(workdir);
  await assert.rejects(
    () => workspaceLocalEnv.load(),
    /Missing local env file/,
  );
}

async function testRuntimeUsesRealProviderModeFromLocalEnv(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-runtime-");
  await writeTestLocalEnv(workdir, {
    provider: "openai",
    apiKey: "openai-key",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
    timeoutMs: 10000,
  });
  const fetchFn: FetchLike = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        choices: [
          {
            message: {
              content: "real provider result",
            },
          },
        ],
      });
    },
  });

  const runtime = createRuntime({
    workdir,
    defaultModelMode: "real_from_local_env",
    realProviderFetchFn: fetchFn,
  });
  const session = await runtime.createSession({});
  const result = await session.execute({
    content: {
      task: "use real provider",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "real provider result");
}

async function testRuntimeLoadsExternalMcpServersFromLocalEnv(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-mcp-runtime-");
  const endpoint = await startTestMcpHttpServer();
  await writeTestLocalEnv(workdir, {
    externalMcpEndpoints: [
      {
        name: "filesystem",
        url: endpoint.url,
      },
    ],
  });

  try {
    const runtime = createRuntime({
      workdir,
      defaultModelMode: "real_from_local_env",
    });
    const session = await runtime.createSession({
      config: {
        model: {
          mock: true,
          mockInfo: {
            content: "{\"thought\":\"use tool\",\"actionType\":\"tool\",\"toolCalls\":[{\"name\":\"remote_echo\",\"arguments\":{\"content\":\"from local env\"}}],\"shouldContinue\":false,\"finalAnswer\":\"done\"}",
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
      state.history.some((item) => item.role === "tool" && item.content.includes("remote:from local env")),
      true,
    );
  } finally {
    await endpoint.close();
  }
}

async function testTerminalCliUsesRealProviderRuntimePath(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-cli-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    apiKey: "deepseek-key",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    timeoutMs: 10000,
  });
  const fetchFn: FetchLike = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        choices: [
          {
            message: {
              content: "cli real provider result",
            },
          },
        ],
      });
    },
  });
  const lines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => {
      const next = lines.some((line) => line.includes("cli real provider result")) ? "exit" : "hello";
      return next;
    },
    writeLine: async (line) => {
      lines.push(line);
    },
    writeError: async () => {},
    createRuntime: ({ workdir: runtimeWorkdir }) => createRuntime({
      workdir: runtimeWorkdir,
      defaultModelMode: "real_from_local_env",
      realProviderFetchFn: fetchFn,
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(lines.some((line) => line.includes("cli real provider result")), true);
}

async function startTestMcpHttpServer(): Promise<{
  url: string;
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
    url: `http://127.0.0.1:${address.port}/mcp`,
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
