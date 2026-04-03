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
    private readonly trace?: Trace,
  ) {}

  async call(input: ToolCallInput): Promise<ToolCallResult> {
    await this.recordToolEvent("tool_started", input, undefined);
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
      await this.recordToolEvent("tool_failed", input, result);
      return result;
    }

    try {
      const handler = this.toolRegistry.resolve(input.toolName);
      const result = await this.executionEnvironment.execute({
        toolCall: input,
        handler,
      });
      if (result.error || result.blockedByPolicy) {
        await this.recordToolEvent("tool_failed", input, result);
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
      await this.recordToolEvent("tool_failed", input, result);
      return result;
    }
  }

  withTrace(trace: Trace): McpGateway {
    return new McpGateway(
      this.permissionPolicy,
      this.toolRegistry,
      this.executionEnvironment,
      trace,
    );
  }

  private async recordToolEvent(
    event: "tool_started" | "tool_failed",
    input: ToolCallInput,
    result?: ToolCallResult,
  ): Promise<void> {
    if (!this.trace) {
      return;
    }
    await this.trace.record({
      type: "tool",
      brief: event === "tool_started" ? "tool.call.started" : "tool.call.failed",
      metadata: {
        timestamp: new Date().toISOString(),
      },
      details: omitUndefined({
        toolName: input.toolName,
        arguments: input.arguments ? { keys: Object.keys(input.arguments) } : undefined,
        result: result
          ? omitUndefined({
              hasContent: result.content.length > 0,
              contentLength: result.content.length,
              exitCode: result.exitCode,
              blockedByPolicy: result.blockedByPolicy,
            })
          : undefined,
        error: result?.error,
        blockedByPolicy: result?.blockedByPolicy,
      }),
    });
  }
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
