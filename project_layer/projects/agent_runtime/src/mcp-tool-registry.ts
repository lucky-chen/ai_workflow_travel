import type { McpToolRequest, McpToolResult } from "./agent-runtime-types.js";

export interface IMcpToolHandler {
  readonly toolName: string;
  call(request: McpToolRequest): Promise<McpToolResult>;
}

export class McpToolRegistry {
  private readonly handlers = new Map<string, IMcpToolHandler>();

  register(handler: IMcpToolHandler): void {
    this.handlers.set(handler.toolName, handler);
  }

  resolve(toolName: string): IMcpToolHandler | undefined {
    return this.handlers.get(toolName);
  }
}
