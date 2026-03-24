import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createProviderMcpServer } from "./src/mcp/provider-mcp-server.js";
import { loadLocalEnv } from "./src/runtime/env-loader.js";
import { initializeTrace } from "./src/runtime/trace-store.js";

const BASE_URL = import.meta.url;
const HTTP_HOST = process.env.TRAVEL_PLANNER_MCP_HOST ?? "127.0.0.1";
const HTTP_PORT = Number(process.env.TRAVEL_PLANNER_MCP_PORT ?? "8787");
const MCP_PATH = process.env.TRAVEL_PLANNER_MCP_PATH ?? "/mcp";

await loadLocalEnv(BASE_URL);
await initializeTrace(BASE_URL);

const transportMode = resolveTransportMode(process.argv);

if (transportMode === "http") {
  await startHttpServer();
} else {
  const server = createProviderMcpServer(BASE_URL);
  await server.connect(new StdioServerTransport());
}

function resolveTransportMode(argv: string[]): "stdio" | "http" {
  return argv.includes("--transport=http") ? "http" : "stdio";
}

async function startHttpServer(): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    try {
      await handleHttpRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP HTTP request:", error);
      if (!res.headersSent) {
        writeJsonRpcError(res, 500, "Internal server error");
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
      httpServer.off("error", reject);
      console.error(
        `travel-planner-provider-mcp listening on http://${HTTP_HOST}:${HTTP_PORT}${MCP_PATH}`,
      );
      resolve();
    });
  });
}

async function handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((req.url ?? "") !== MCP_PATH) {
    res.writeHead(404).end();
    return;
  }

  if (req.method === "POST") {
    const parsedBody = await readJsonBody(req);
    const server = createProviderMcpServer(BASE_URL);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await transport.handleRequest(req, res, parsedBody);
    return;
  }

  if (req.method === "GET" || req.method === "DELETE") {
    writeJsonRpcError(res, 405, "Method not allowed.");
    return;
  }

  writeJsonRpcError(res, 405, "Method not allowed.");
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return undefined;
  }

  return JSON.parse(rawBody);
}

function writeJsonRpcError(res: ServerResponse, statusCode: number, message: string): void {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message,
    },
    id: null,
  });
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}
