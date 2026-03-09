import type {
  AgentContext,
  ExecutionPlan,
  ExecutionResult,
  IExecutor,
  IModelExecutionBackend,
  IMcpGateway,
  LlmExecutionRequest,
  McpToolResult,
} from "./agent-runtime-types.js";

export class DefaultExecutor implements IExecutor {
  constructor(
    private readonly backend: IModelExecutionBackend,
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

    const result = await this.backend.execute(buildExecutionRequest(context.request, toolResults));
    return toolResults.length > 0 ? { result, toolResults } : { result };
  }
}

function buildExecutionRequest(
  request: LlmExecutionRequest,
  toolResults: McpToolResult[],
): LlmExecutionRequest {
  if (toolResults.length === 0) {
    return request;
  }

  return {
    ...request,
    prompt: {
      ...request.prompt,
      userPrompt: [
        request.prompt.userPrompt,
        "",
        "MCP tool results:",
        JSON.stringify(toolResults, null, 2),
      ].join("\n"),
    },
  };
}
