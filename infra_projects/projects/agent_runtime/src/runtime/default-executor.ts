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

    const result = await this.backend.execute(buildExecutionRequest(context, plan, toolResults));
    return {
      content: result.content,
      responseFormat: result.responseFormat,
      metadata: result.metadata,
      ...(toolResults.length > 0 ? { toolResults } : {}),
    };
  }
}

function buildExecutionRequest(
  context: AgentContext,
  plan: ExecutionPlan,
  toolResults: McpToolResult[],
): ModelBackendRequest {
  return {
    mode: "execution",
    responseFormat: context.request.responseFormat,
    metadata: context.request.metadata,
    prompt: {
      systemPrompt: [...context.request.prompt.systemPrompt],
      userPrompt: {
        ...context.request.prompt.userPrompt,
        nextStepGoal: plan.nextStepGoal,
        ...(toolResults.length > 0 ? { toolResults } : {}),
      },
    },
  };
}
