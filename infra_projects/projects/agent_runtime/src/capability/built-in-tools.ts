import type { ToolCallInput, ToolCallResult, ToolDefinition } from "./types.js";

export function createBuiltInToolDefinitions(): ToolDefinition[] {
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
        handle(_input: ToolCallInput): Promise<ToolCallResult> {
          void _input;
          return Promise.resolve({
            content: "hello",
            exitCode: 0,
          });
        },
      },
    },
  ];
}
