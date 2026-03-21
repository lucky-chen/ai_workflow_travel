import type { Readable, Writable } from "node:stream";

import type { McpAgentResult } from "./types.js";
import type { McpServerApi } from "./server.js";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface StdioServerOptions {
  input?: Readable;
  output?: Writable;
  error?: Writable;
  serverInfo?: {
    name: string;
    version: string;
  };
}

export class McpStdioServer {
  private readonly input: Readable;

  private readonly output: Writable;

  private readonly error: Writable;

  private readonly api: McpServerApi;

  private readonly serverInfo: { name: string; version: string };

  private buffer = Buffer.alloc(0);

  private sequence = Promise.resolve();

  constructor(api: McpServerApi, options: StdioServerOptions = {}) {
    this.api = api;
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.error = options.error ?? process.stderr;
    this.serverInfo = options.serverInfo ?? {
      name: "sdlc-mcp",
      version: "0.1.0",
    };
  }

  start(): void {
    this.input.on("data", (chunk: Buffer | string) => {
      this.consumeChunk(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
    });
    this.input.on("error", (error) => {
      this.error.write(`${formatError(error)}\n`);
    });
  }

  private consumeChunk(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return;
      }

      const headerText = this.buffer.subarray(0, headerEnd).toString("utf8");
      const contentLength = readContentLength(headerText);
      if (contentLength === null) {
        this.buffer = Buffer.alloc(0);
        return;
      }

      const totalLength = headerEnd + 4 + contentLength;
      if (this.buffer.length < totalLength) {
        return;
      }

      const body = this.buffer.subarray(headerEnd + 4, totalLength).toString("utf8");
      this.buffer = this.buffer.subarray(totalLength);
      this.sequence = this.sequence.then(() => this.handleBody(body)).catch((error) => {
        this.error.write(`${formatError(error)}\n`);
      });
    }
  }

  private async handleBody(body: string): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(body) as JsonRpcRequest;
    } catch {
      this.writeResponse({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      });
      return;
    }

    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      this.writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: -32600,
          message: "Invalid Request",
        },
      });
      return;
    }

    if (request.method === "notifications/initialized") {
      return;
    }

    if (request.method === "ping") {
      this.writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {},
      });
      return;
    }

    if (request.method === "initialize") {
      this.writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          protocolVersion: readProtocolVersion(request.params),
          capabilities: {
            tools: {},
          },
          serverInfo: this.serverInfo,
        },
      });
      return;
    }

    if (request.method === "tools/list") {
      const tools = await this.api.listTools();
      this.writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: { tools },
      });
      return;
    }

    if (request.method === "tools/call") {
      const result = await this.invokeTool(request.params);
      this.writeResponse({
        jsonrpc: "2.0",
        id: request.id ?? null,
        result,
      });
      return;
    }

    this.writeResponse({
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: -32601,
        message: `Method not found: ${request.method}`,
      },
    });
  }

  private async invokeTool(params: unknown): Promise<{
    content: Array<{ type: "text"; text: string }>;
    structuredContent: McpAgentResult;
    isError: boolean;
  }> {
    try {
      const request = readToolRequest(params);
      const structuredContent = await this.api.invokeTool(request);
      return {
        content: [{ type: "text", text: structuredContent.message }],
        structuredContent,
        isError: structuredContent.status === "failed",
      };
    } catch (error) {
      const message = formatError(error);
      return {
        content: [{ type: "text", text: message }],
        structuredContent: {
          status: "failed",
          message,
        },
        isError: true,
      };
    }
  }

  private writeResponse(response: JsonRpcResponse): void {
    const body = JSON.stringify(response);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.output.write(header);
    this.output.write(body);
  }
}

function readContentLength(headerText: string): number | null {
  const lines = headerText.split("\r\n");
  const contentLengthLine = lines.find((line) => line.toLowerCase().startsWith("content-length:"));
  if (!contentLengthLine) {
    return null;
  }

  const value = Number.parseInt(contentLengthLine.slice("content-length:".length).trim(), 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function readProtocolVersion(params: unknown): string {
  if (!params || typeof params !== "object") {
    return "2024-11-05";
  }

  const protocolVersion = (params as { protocolVersion?: unknown }).protocolVersion;
  return typeof protocolVersion === "string" && protocolVersion.length > 0
    ? protocolVersion
    : "2024-11-05";
}

function readToolRequest(params: unknown): { name: string; arguments: Record<string, unknown> } {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid MCP tools/call params.");
  }

  const name = (params as { name?: unknown }).name;
  const input = (params as { arguments?: unknown }).arguments;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Invalid MCP tools/call params: name must be a non-empty string.");
  }

  if (input === undefined) {
    return { name, arguments: {} };
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid MCP tools/call params: arguments must be an object.");
  }

  return {
    name,
    arguments: input as Record<string, unknown>,
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
