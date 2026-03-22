import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";

import type { McpServerApi } from "./server.js";
import type { McpAgentResult, McpToolDefinition } from "./types.js";

interface StdioServerOptions {
  serverInfo?: {
    name: string;
    version: string;
  };
}

export class McpStdioServer {
  private readonly api: McpServerApi;

  private readonly serverInfo: { name: string; version: string };

  constructor(api: McpServerApi, options: StdioServerOptions = {}) {
    this.api = api;
    this.serverInfo = options.serverInfo ?? {
      name: "sdlc-mcp",
      version: "0.1.0",
    };
  }

  async start(): Promise<void> {
    const mcpServer = new McpServer(this.serverInfo);
    const tools = await this.api.listTools();

    for (const tool of tools) {
      mcpServer.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: buildZodSchema(tool),
        },
        async (args) => {
          const result = await this.api.invokeTool({
            name: tool.name,
            arguments: args,
          });
          return {
            content: [{ type: "text", text: result.message }],
            structuredContent: toStructuredContent(result),
            isError: result.status === "failed",
          };
        },
      );
    }

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  }
}

function toStructuredContent(result: McpAgentResult): Record<string, unknown> {
  return {
    status: result.status,
    message: result.message,
    ...(result.files ? { files: result.files } : {}),
    ...(result.issues ? { issues: result.issues } : {}),
    ...(result.agentAction ? { agentAction: result.agentAction } : {}),
  };
}

function buildZodSchema(tool: McpToolDefinition): z.ZodObject<z.ZodRawShape> {
  const required = new Set(tool.inputSchema.required ?? []);
  const shape = Object.fromEntries(
    Object.keys(tool.inputSchema.properties).map((field) => [
      field,
      required.has(field)
        ? z.string().min(1)
        : z.string().min(1).optional(),
    ]),
  );

  return z.object(shape).strict();
}
