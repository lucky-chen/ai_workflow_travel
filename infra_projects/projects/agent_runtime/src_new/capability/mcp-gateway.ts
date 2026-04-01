import type {
  ExecutionEnvironment as ExecutionEnvironmentContract,
  McpGateway as McpGatewayContract,
  McpToolRegistry as McpToolRegistryContract,
  RuntimePermissionPolicy as RuntimePermissionPolicyContract,
  ToolCallInput,
  ToolCallResult,
} from "./types.js";
import type { RuntimeEventBus } from "./runtime-event-bus.js";

export class McpGateway implements McpGatewayContract {
  constructor(
    private readonly permissionPolicy: RuntimePermissionPolicyContract,
    private readonly toolRegistry: McpToolRegistryContract,
    private readonly executionEnvironment: ExecutionEnvironmentContract,
    private readonly eventBus: RuntimeEventBus,
  ) {}

  async call(input: ToolCallInput): Promise<ToolCallResult> {
    await this.eventBus.publish({
      type: "tool_started",
      metadata: {
        traceId: input.toolCallId,
        timestamp: new Date().toISOString(),
      },
      agent: {
        ...(input.eventAgent ?? {
          name: "react",
        }),
        tool: {
          toolName: input.toolName,
          arguments: input.arguments,
        },
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
      await this.eventBus.publish({
        type: "tool_completed",
        metadata: {
          traceId: input.toolCallId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          ...(input.eventAgent ?? {
            name: "react",
          }),
          tool: {
            toolName: input.toolName,
            arguments: input.arguments,
            error: result.error,
          },
        },
        custom: {
          blockedByPolicy: true,
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
      await this.eventBus.publish({
        type: "tool_completed",
        metadata: {
          traceId: input.toolCallId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          ...(input.eventAgent ?? {
            name: "react",
          }),
          tool: {
            toolName: input.toolName,
            arguments: input.arguments,
            error: result.error,
          },
        },
        custom: {
          blockedByPolicy: result.blockedByPolicy ?? false,
        },
      });
      return result;
    } catch (error) {
      const result = {
        content: "",
        error: {
          code: "TOOL_CALL_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
      await this.eventBus.publish({
        type: "tool_completed",
        metadata: {
          traceId: input.toolCallId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          ...(input.eventAgent ?? {
            name: "react",
          }),
          tool: {
            toolName: input.toolName,
            arguments: input.arguments,
            error: result.error,
          },
        },
        custom: {
          blockedByPolicy: false,
        },
      });
      return result;
    }
  }
}
