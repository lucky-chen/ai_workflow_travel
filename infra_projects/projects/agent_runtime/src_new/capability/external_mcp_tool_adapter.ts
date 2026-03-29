import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { ExternalMcpServerConfig, McpToolRegistry, ToolCallInput, ToolCallResult, ToolHandler } from "./types.js";

interface ConnectedExternalMcpServer {
  client: Client;
  tools: Tool[];
}

export async function registerExternalMcpServers(
  registry: McpToolRegistry,
  servers: ExternalMcpServerConfig[],
): Promise<void> {
  for (const server of servers) {
    const connected = await connectExternalMcpServer(server);
    for (const tool of connected.tools) {
      await registry.register(tool.name, createExternalMcpToolHandler(connected.client, tool));
    }
  }
}

function createExternalMcpToolHandler(client: Client, tool: Tool): ToolHandler {
  return {
    async handle(input: ToolCallInput): Promise<ToolCallResult> {
      try {
        const result = await client.callTool({
          name: tool.name,
          arguments: input.arguments,
        });
        const content = normalizeToolResultContent(result.content);
        if (result.isError) {
          return {
            content,
            error: {
              code: "MCP_TOOL_ERROR",
              message: content || `External MCP tool ${tool.name} failed.`,
            },
          };
        }
        return {
          content,
          exitCode: 0,
        };
      } catch (error) {
        return {
          content: "",
          error: {
            code: "MCP_TOOL_CALL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  };
}

async function connectExternalMcpServer(server: ExternalMcpServerConfig): Promise<ConnectedExternalMcpServer> {
  const client = new Client({
    name: server.name ?? "agent-runtime-external-mcp",
    version: "0.1.0",
  });
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args,
    env: server.env,
    cwd: server.cwd,
  });
  await client.connect(transport);
  return {
    client,
    tools: await listAllTools(client),
  };
}

async function listAllTools(client: Client): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;
  do {
    const result = await client.listTools(cursor ? { cursor } : {});
    tools.push(...result.tools);
    cursor = result.nextCursor;
  } while (cursor);
  return tools;
}

function normalizeToolResultContent(content: ToolCallResult["content"] | unknown): string {
  if (!Array.isArray(content)) {
    return typeof content === "string" ? content : JSON.stringify(content ?? "");
  }
  return content.map((item) => {
    if (
      item
      && typeof item === "object"
      && "type" in item
      && item.type === "text"
      && "text" in item
      && typeof item.text === "string"
    ) {
      return item.text;
    }
    return JSON.stringify(item);
  }).join("\n");
}
