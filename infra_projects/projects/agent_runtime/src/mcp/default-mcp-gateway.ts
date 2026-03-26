import type { IMcpGateway, McpToolRequest, McpToolResult } from "../runtime/agent-runtime-types.js";
import { FileReadMcpToolHandler } from "./file-read-mcp-tool-handler.js";
import { FileWriteMcpToolHandler } from "./file-write-mcp-tool-handler.js";
import { McpToolRegistry } from "./mcp-tool-registry.js";

export class DefaultMcpGateway implements IMcpGateway {
  private readonly registry: McpToolRegistry;

  constructor(registry?: McpToolRegistry) {
    this.registry = registry ?? createDefaultRegistry();
  }

  async call(request: McpToolRequest): Promise<McpToolResult> {
    const handler = this.registry.resolve(request.toolName);
    if (!handler) {
      throw new Error(`Unsupported MCP tool: ${request.toolName}`);
    }

    return handler.call(request);
  }

  listToolNames(): string[] {
    return this.registry.listToolNames();
  }
}

function createDefaultRegistry(): McpToolRegistry {
  const registry = new McpToolRegistry();
  registry.register(new FileReadMcpToolHandler());
  registry.register(new FileWriteMcpToolHandler());
  return registry;
}
