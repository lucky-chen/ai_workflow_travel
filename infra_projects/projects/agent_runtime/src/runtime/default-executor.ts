import { ExecutionPromptBuilder } from "../loop/execution-prompt-builder.js";
import type {
  AgentContext,
  ExecutionPlan,
  ExecutionResult,
  IExecutor,
  IModelBackend,
  IMcpGateway,
  McpToolResult,
  ModelBackendRequest,
} from "./agent-runtime-types.js";

export class DefaultExecutor implements IExecutor {
  constructor(
    private readonly backend: IModelBackend,
    private readonly mcpGateway?: IMcpGateway,
    private readonly promptBuilder: ExecutionPromptBuilder = new ExecutionPromptBuilder(),
  ) {}

  async execute(context: AgentContext, plan: ExecutionPlan): Promise<ExecutionResult> {
    const toolResults: McpToolResult[] = [];
    if (plan.mode === "tool_augmented_generation") {
      if (!this.mcpGateway) {
        throw new Error("MCP gateway is required for tool-augmented execution plans.");
      }

      for (const toolStep of plan.toolSteps ?? []) {
        toolResults.push(await this.mcpGateway.call(toolStep));
      }
    }

    const result = await this.backend.execute(
      this.promptBuilder.build({
        context,
        plan,
        ...(toolResults.length > 0 ? { toolResults } : {}),
      }),
    );
    return {
      content: result.content,
      responseFormat: result.responseFormat,
      metadata: result.metadata,
      ...(toolResults.length > 0 ? { toolResults } : {}),
    };
  }
}
