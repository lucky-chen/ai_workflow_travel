import type { McpToolRegistry as McpToolRegistryContract, ToolDefinition, ToolHandler } from "./types.js";

export class McpToolRegistry implements McpToolRegistryContract {
  private readonly definitions = new Map<string, ToolDefinition>();

  constructor(initialDefinitions?: ToolDefinition[]) {
    for (const definition of initialDefinitions ?? []) {
      this.definitions.set(definition.name, definition);
    }
  }

  register(definition: ToolDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  resolve(toolName: string): ToolHandler {
    const definition = this.definitions.get(toolName);
    if (!definition) {
      throw new Error(`Tool handler not found for ${toolName}.`);
    }
    return definition.handler;
  }

  getDefinition(toolName: string): ToolDefinition | undefined {
    return this.definitions.get(toolName);
  }

  listToolNames(): string[] {
    return [...this.definitions.keys()].sort();
  }

  listToolDefinitions(): ToolDefinition[] {
    return [...this.definitions.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}
