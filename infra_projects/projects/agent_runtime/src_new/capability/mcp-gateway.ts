import type {
  ExecutionEnvironment as ExecutionEnvironmentContract,
  McpGateway as McpGatewayContract,
  McpToolRegistry as McpToolRegistryContract,
  RuntimePermissionPolicy as RuntimePermissionPolicyContract,
  ToolCallInput,
  ToolCallResult,
} from "./types.js";
import type { Trace } from "../observability/trace.js";

export class McpGateway implements McpGatewayContract {
  constructor(
    private readonly permissionPolicy: RuntimePermissionPolicyContract,
    private readonly toolRegistry: McpToolRegistryContract,
    private readonly executionEnvironment: ExecutionEnvironmentContract,
    private readonly trace: Trace,
  ) {}

  async call(input: ToolCallInput): Promise<ToolCallResult> {
    await this.trace.record({
      traceId: input.toolCallId,
      scope: "session",
      eventType: "tool_called",
      timestamp: new Date().toISOString(),
      summary: `tool called: ${input.toolName}`,
    });
    const decision = await this.permissionPolicy.evaluate({
      toolCall: input,
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
      return await this.executionEnvironment.execute({
        toolCall: input,
        handler,
      });
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
