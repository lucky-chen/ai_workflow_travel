import type { ToolCallInput, ToolCallResult, ToolDefinition } from "./types.js";

export function createBuiltInToolDefinitions(_rootDir: string): ToolDefinition[] {
  return [
    {
      name: "echo_hello",
      description: "Return the fixed text hello. Test-only built-in tool.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
          },
        },
        required: ["content"],
      },
      handler: {
        async handle(_input: ToolCallInput): Promise<ToolCallResult> {
          return {
            content: "hello",
            exitCode: 0,
          };
        },
      },
    },
  ];
}
