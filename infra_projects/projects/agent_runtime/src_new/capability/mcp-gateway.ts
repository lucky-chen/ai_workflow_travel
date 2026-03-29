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
      scope: "session",
      eventType: "tool_called",
      payload: {
        toolName: input.toolName,
      },
      metadata: {
        traceId: input.toolCallId,
        timestamp: new Date().toISOString(),
      },
    });
    const decision = await this.permissionPolicy.evaluate({
      toolCall: input,
    });
    if (!decision.allowed) {
      const result = {
        content: "",
        blockedByPolicy: true,
        error: {
          code: decision.reasonCode ?? "TOOL_CALL_BLOCKED",
          message: decision.message ?? "Tool call blocked by runtime permission policy.",
        },
      };
      await this.trace.record({
        scope: "session",
        eventType: "tool_result_recorded",
        payload: {
          toolName: input.toolName,
          arguments: input.arguments,
          blockedByPolicy: true,
          error: result.error,
        },
        metadata: {
          traceId: input.toolCallId,
          timestamp: new Date().toISOString(),
        },
      });
      return result;
    }

    try {
      const handler = await this.toolRegistry.resolve(input.toolName);
      const result = await this.executionEnvironment.execute({
        toolCall: input,
        handler,
      });
      if (result.error || result.blockedByPolicy) {
        await this.trace.record({
          scope: "session",
          eventType: "tool_result_recorded",
          payload: {
            toolName: input.toolName,
            arguments: input.arguments,
            blockedByPolicy: result.blockedByPolicy ?? false,
            error: result.error,
          },
          metadata: {
            traceId: input.toolCallId,
            timestamp: new Date().toISOString(),
          },
        });
      }
      return result;
    } catch (error) {
      const result = {
        content: "",
        error: {
          code: "TOOL_CALL_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
      await this.trace.record({
        scope: "session",
        eventType: "tool_result_recorded",
        payload: {
          toolName: input.toolName,
          arguments: input.arguments,
          blockedByPolicy: false,
          error: result.error,
        },
        metadata: {
          traceId: input.toolCallId,
          timestamp: new Date().toISOString(),
        },
      });
      return result;
    }
  }
}
