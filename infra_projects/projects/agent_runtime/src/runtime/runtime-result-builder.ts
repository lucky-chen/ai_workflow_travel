import type {
  AgentRuntimeResult,
  ExecutionResult,
  McpToolResult,
  ObservationResult,
  ValidationIssue,
  ValidationResult,
} from "./agent-runtime-types.js";

export interface RuntimeResultBuilderInput {
  executionResult?: ExecutionResult;
  observation?: ObservationResult;
  toolResults?: McpToolResult[];
  summary: string;
  stopReason: "completed" | "max_steps" | "cancelled" | "failed";
  lastStepIndex: number;
  diagnostics?: ValidationIssue[];
}

export class RuntimeResultBuilder {
  buildSuccess(input: RuntimeResultBuilderInput): AgentRuntimeResult {
    return this.build("success", input);
  }

  buildFailure(input: RuntimeResultBuilderInput): AgentRuntimeResult {
    return this.build("failed", input);
  }

  buildFailureFromValidation(
    code: string,
    stepIndex: number,
    validation: ValidationResult<unknown>,
  ): AgentRuntimeResult {
    return this.buildFailure({
      summary: code,
      stopReason: "failed",
      lastStepIndex: stepIndex,
      diagnostics: validation.issues,
    });
  }

  private build(
    status: AgentRuntimeResult["status"],
    input: RuntimeResultBuilderInput,
  ): AgentRuntimeResult {
    return {
      status,
      payload: {
        ...(input.executionResult
          ? {
              content: input.executionResult.content,
              responseFormat: input.executionResult.responseFormat,
            }
          : {}),
        ...((input.toolResults?.length ?? 0) > 0 ? { toolResults: input.toolResults } : {}),
        ...(input.observation
          ? {
              accepted: input.observation.accepted,
              completed: input.observation.completed,
            }
          : {}),
        summary: input.summary,
        stopReason: input.stopReason,
        lastStepIndex: input.lastStepIndex,
      },
      ...(input.diagnostics?.length ? { diagnostics: input.diagnostics } : {}),
    };
  }
}
