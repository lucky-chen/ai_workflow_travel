import type { AgentContext, ExecutionPlan, IPlanner, McpToolRequest } from "./agent-runtime-types.js";

export class DefaultPlanner implements IPlanner {
  async plan(context: AgentContext): Promise<ExecutionPlan> {
    const toolSteps = readToolSteps(context.inputPayload);
    if (toolSteps.length > 0) {
      return {
        mode: "tool_augmented_generation",
        summary: "Use MCP-backed tool execution before generation.",
        toolSteps,
      };
    }

    return {
      mode: "direct_generation",
      summary: "Use direct generation for the current request.",
    };
  }
}

function readToolSteps(inputPayload: Record<string, unknown>): McpToolRequest[] {
  const rawToolSteps = inputPayload.mcpToolCalls;
  if (!Array.isArray(rawToolSteps)) {
    return [];
  }

  return rawToolSteps
    .filter((entry): entry is { toolName: string; arguments?: Record<string, unknown> } =>
      !!entry
      && typeof entry === "object"
      && typeof (entry as { toolName?: unknown }).toolName === "string")
    .map((entry) => ({
      toolName: entry.toolName,
      arguments: isRecord(entry.arguments) ? entry.arguments : {},
    }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
