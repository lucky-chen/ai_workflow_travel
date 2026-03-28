import type { McpToolRegistry, ToolHandler } from "./types.js";

export class InMemoryMcpToolRegistry implements McpToolRegistry {
  private readonly handlers = new Map<string, ToolHandler>();

  constructor(initialHandlers?: Record<string, ToolHandler>) {
    for (const [toolName, handler] of Object.entries(initialHandlers ?? {})) {
      this.handlers.set(toolName, handler);
    }
  }

  async register(toolName: string, handler: ToolHandler): Promise<void> {
    this.handlers.set(toolName, handler);
  }

  async resolve(toolName: string): Promise<ToolHandler> {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      throw new Error(`Tool handler not found for ${toolName}.`);
    }
    return handler;
  }

  async listToolNames(): Promise<string[]> {
    return [...this.handlers.keys()].sort();
  }
}
