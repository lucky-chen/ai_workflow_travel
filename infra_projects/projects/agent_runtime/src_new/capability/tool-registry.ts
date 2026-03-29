import type { McpToolRegistry as McpToolRegistryContract, ToolDefinition, ToolHandler } from "./types.js";

export class McpToolRegistry implements McpToolRegistryContract {
  private readonly definitions = new Map<string, ToolDefinition>();

  constructor(initialDefinitions?: ToolDefinition[]) {
    for (const definition of initialDefinitions ?? []) {
      this.definitions.set(definition.name, definition);
    }
  }

  async register(definition: ToolDefinition): Promise<void> {
    this.definitions.set(definition.name, definition);
  }

  async resolve(toolName: string): Promise<ToolHandler> {
    const definition = this.definitions.get(toolName);
    if (!definition) {
      throw new Error(`Tool handler not found for ${toolName}.`);
    }
    return definition.handler;
  }

  async listToolNames(): Promise<string[]> {
    return [...this.definitions.keys()].sort();
  }

  async listToolDefinitions(): Promise<ToolDefinition[]> {
    return [...this.definitions.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}
