import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type {
  ExternalMcpEndpointConfig,
  McpToolRegistry,
  ToolCallInput,
  ToolCallResult,
  ToolDefinition,
  ToolHandler,
} from "./types.js";
import type { RuntimeEventBus } from "./runtime-event-bus.js";

interface ConnectedExternalMcpEndpoint {
  client: Client;
  tools: Tool[];
}

export async function registerExternalMcpEndpoints(
  registry: McpToolRegistry,
  endpoints: ExternalMcpEndpointConfig[],
  eventBus?: RuntimeEventBus,
): Promise<void> {
  const endpointSummaries: Array<{
    endpointName: string;
    toolCount: number;
    toolNames: string[];
  }> = [];

  for (const endpoint of endpoints) {
    const connected = await connectExternalMcpEndpoint(endpoint);
    for (const tool of connected.tools) {
      await registry.register(createExternalMcpToolDefinition(connected.client, tool));
    }
    endpointSummaries.push({
      endpointName: endpoint.name ?? endpoint.url,
      toolCount: connected.tools.length,
      toolNames: connected.tools.map((tool) => tool.name),
    });
  }

  if (endpointSummaries.length === 0) {
    return;
  }

  await eventBus?.publish({
    type: "runtime",
    runtimeMessage: {
      event: "external_mcp_registered",
      timestamp: new Date().toISOString(),
      custom: {
        endpointCount: endpointSummaries.length,
        toolCount: endpointSummaries.reduce((total, endpoint) => total + endpoint.toolCount, 0),
        endpoints: endpointSummaries,
      },
    },
  });
}

function createExternalMcpToolDefinition(client: Client, tool: Tool): ToolDefinition {
  const outputSchema = getOutputSchema(tool);
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: isRecord(tool.inputSchema) ? tool.inputSchema : undefined,
    outputSchema: isRecord(outputSchema) ? outputSchema : undefined,
    handler: createExternalMcpToolHandler(client, tool),
  };
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

function getOutputSchema(tool: Tool): unknown {
  return Reflect.get(tool, "outputSchema");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function connectExternalMcpEndpoint(endpoint: ExternalMcpEndpointConfig): Promise<ConnectedExternalMcpEndpoint> {
  const client = new Client({
    name: endpoint.name ?? "agent-runtime-external-mcp",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), {
    requestInit: endpoint.headers
      ? {
        headers: endpoint.headers,
      }
      : undefined,
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
