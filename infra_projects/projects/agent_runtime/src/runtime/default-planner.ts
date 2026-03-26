import type { AgentContext, ExecutionPlan, IPlanner, McpToolRequest } from "./agent-runtime-types.js";

export class DefaultPlanner implements IPlanner {
  async plan(context: AgentContext): Promise<ExecutionPlan> {
    const toolSteps = context.runtimeContext.mcpToolCalls;
    if (toolSteps.length > 0) {
      return {
        mode: "tool_augmented_generation",
        summary: "Use MCP-backed tool execution before generation.",
        stepIndex: 1,
        nextStepGoal: "Execute tool steps and generate runtime output.",
        toolSteps,
      };
    }

    return {
      mode: "direct_generation",
      summary: "Use direct generation for the current request.",
      stepIndex: 1,
      nextStepGoal: "Generate runtime output directly.",
    };
  }
}
