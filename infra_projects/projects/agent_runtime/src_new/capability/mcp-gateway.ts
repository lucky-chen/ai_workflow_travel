import type {
  ExecutionEnvironment,
  McpGateway,
  McpToolRegistry,
  RuntimePermissionPolicy,
  ToolCallInput,
  ToolCallResult,
} from "./types.js";

export class DefaultMcpGateway implements McpGateway {
  constructor(
    private readonly permissionPolicy: RuntimePermissionPolicy,
    private readonly toolRegistry: McpToolRegistry,
    private readonly executionEnvironment: ExecutionEnvironment,
  ) {}

  async call(input: ToolCallInput): Promise<ToolCallResult> {
    const decision = await this.permissionPolicy.evaluate({
      toolCall: input,
      allowedWorkingDirectories: input.allowedWorkingDirectories,
    });
    if (!decision.allowed) {
      return {
        content: "",
        blockedByPolicy: true,
        error: {
          code: decision.reasonCode ?? "TOOL_CALL_BLOCKED",
          message: decision.message ?? "Tool call blocked by runtime permission policy.",
        },
      };
    }

    try {
      const handler = await this.toolRegistry.resolve(input.toolName);
      return await this.executionEnvironment.execute(input, handler);
    } catch (error) {
      return {
        content: "",
        error: {
          code: "TOOL_CALL_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
