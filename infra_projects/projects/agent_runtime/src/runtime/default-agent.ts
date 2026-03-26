import { AgentTraceApi } from "./agent-trace-api.js";
import type { IAgentTraceRecorder } from "./agent-trace-recorder.js";
import type {
  AgentContext,
  ExecutionPlan,
  ExecutionResult,
  AgentRuntimeResult,
  IAgent,
  IExecutor,
  IObserver,
  IPlanner,
  McpToolResult,
  ObservationResult,
  ValidationIssue,
  ValidationResult,
} from "./agent-runtime-types.js";
import type { PlanValidator } from "../loop/plan-validator.js";
import type { ExecutionResultValidator } from "../loop/execution-result-validator.js";
import type { ObservationValidator } from "../loop/observation-validator.js";
import { extractJsonLikeContent } from "./json-content.js";
import { RuntimeResultBuilder } from "./runtime-result-builder.js";
import { ProviderExecutionError } from "./provider-execution-error.js";

export class DefaultAgent implements IAgent {
  private readonly traceApi: AgentTraceApi;
  private readonly resultBuilder = new RuntimeResultBuilder();

  constructor(
    private readonly planner: IPlanner,
    private readonly planValidator: PlanValidator,
    private readonly executor: IExecutor,
    private readonly executionResultValidator: ExecutionResultValidator,
    private readonly observer: IObserver,
    private readonly observationValidator: ObservationValidator,
    private readonly traceRecorder?: IAgentTraceRecorder,
    private readonly maxSteps = 3,
  ) {
    this.traceApi = new AgentTraceApi(traceRecorder);
  }

  async run(context: AgentContext): Promise<AgentRuntimeResult> {
    const runId = context.runtimeContext.runId ?? createRunId();
    const sessionId = context.runtimeContext.sessionId;
    const loopState: AgentLoopState = {
      lastObservation: undefined,
      lastResult: undefined,
      priorStepResults: [],
      collectedToolResults: [],
    };

    await this.traceApi.recordRunStarted(sessionId, runId);

    for (let stepIndex = 1; stepIndex <= this.maxSteps; stepIndex += 1) {
      const stepResult = await this.runStep(context, runId, stepIndex, loopState);
      if (stepResult.type === "continue") {
        loopState.lastObservation = stepResult.observation;
        continue;
      }
      if (stepResult.type === "failed") {
        return stepResult.result;
      }
      if (stepResult.type === "completed") {
        return stepResult.result;
      }
    }

    return this.buildMaxStepsResult(sessionId, runId, loopState.lastResult);
  }

  private async planWithRepair(
    context: AgentContext,
    runId: string,
    loopState: {
      stepIndex: number;
      priorStepResults: ExecutionResult[];
      priorObservation?: ObservationResult;
    },
  ): Promise<ValidationResult<ExecutionPlan>> {
    await this.traceApi.recordPlanStarted(context.runtimeContext.sessionId, runId, loopState.stepIndex);
    let firstPlan: ExecutionPlan;
    try {
      firstPlan = await this.planner.plan(context, loopState);
    } catch (error) {
      return {
        ok: false,
        issues: [buildPlanningErrorIssue(error)],
      };
    }
    await this.traceApi.recordPlanGenerated(context.runtimeContext.sessionId, runId, firstPlan);

    const firstValidation = this.planValidator.validate(firstPlan);
    if (firstValidation.ok && firstValidation.value) {
      return firstValidation;
    }

    let repairedPlan: ExecutionPlan;
    try {
      await this.traceApi.recordPlanStarted(context.runtimeContext.sessionId, runId, loopState.stepIndex);
      repairedPlan = await this.planner.plan(context, {
        ...loopState,
        repairPhase: "plan",
        repairIssues: firstValidation.issues,
      });
    } catch (error) {
      return {
        ok: false,
        issues: [buildPlanningErrorIssue(error)],
      };
    }
    await this.traceApi.recordPlanGenerated(context.runtimeContext.sessionId, runId, repairedPlan);
    return this.planValidator.validate(repairedPlan);
  }

  private async runStep(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    state: AgentLoopState,
  ): Promise<RunStepResult> {
    const sessionId = context.runtimeContext.sessionId;
    const planningState = {
      stepIndex,
      priorStepResults: state.priorStepResults,
      priorObservation: state.lastObservation,
    };
    const validatedPlan = await this.planWithRepair(context, runId, planningState);
    if (!validatedPlan.ok || !validatedPlan.value) {
      await this.traceApi.recordValidationFailed(sessionId, runId, stepIndex, "plan", "fail", validatedPlan.issues ?? []);
      await this.traceApi.recordRunFailed(sessionId, runId, "plan_validation_failed", "failed", stepIndex);
      return {
        type: "failed",
        result: this.resultBuilder.buildFailureFromValidation("plan_validation_failed", stepIndex, validatedPlan),
      };
    }

    const executionOutcome = await this.executeStep(context, runId, stepIndex, validatedPlan.value);
    if (executionOutcome.type === "continue") {
      return executionOutcome;
    }
    if (executionOutcome.type === "failed") {
      return executionOutcome;
    }

    return this.observeStep(
      context,
      runId,
      stepIndex,
      validatedPlan.value,
      executionOutcome.executionResult,
      state,
    );
  }

  private async executeStep(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    plan: ExecutionPlan,
  ): Promise<StepExecutionOutcome> {
    const sessionId = context.runtimeContext.sessionId;
    let executionResult: ExecutionResult;

    try {
      await this.traceApi.recordExecuteStarted(sessionId, runId, plan);
      executionResult = await this.executor.execute(context, plan);
    } catch (error) {
      const issues = [buildExecutionErrorIssue(error)];
      if (stepIndex < this.maxSteps) {
        await this.traceApi.recordValidationFailed(sessionId, runId, stepIndex, "execution", "replan", issues);
        return {
          type: "continue",
          observation: buildRepairObservation(
            "Execution threw an error. Re-plan with execution issues.",
            issues,
          ),
        };
      }
      await this.traceApi.recordValidationFailed(sessionId, runId, stepIndex, "execution", "fail", issues);
      await this.traceApi.recordRunFailed(sessionId, runId, "execution_error", "failed", stepIndex);
      return {
        type: "failed",
        result: this.resultBuilder.buildFailure({
          summary: "execution_error",
          stopReason: "failed",
          lastStepIndex: stepIndex,
          diagnostics: issues,
        }),
      };
    }

    await this.traceApi.recordToolResults(sessionId, runId, stepIndex, executionResult.toolResults);
    await this.traceApi.recordExecutionFinished(sessionId, runId, stepIndex, executionResult);

    const validatedExecutionResult = this.validateExecutionResult(context, plan, executionResult);
    if (!validatedExecutionResult.ok || !validatedExecutionResult.value) {
      if (stepIndex < this.maxSteps) {
        await this.traceApi.recordValidationFailed(
          sessionId,
          runId,
          stepIndex,
          "execution",
          "replan",
          validatedExecutionResult.issues ?? [],
        );
        return {
          type: "continue",
          observation: buildRepairObservation(
            "Execution validation failed. Re-plan with validation issues.",
            validatedExecutionResult.issues ?? [],
          ),
        };
      }
      await this.traceApi.recordValidationFailed(
        sessionId,
        runId,
        stepIndex,
        "execution",
        "fail",
        validatedExecutionResult.issues ?? [],
      );
      await this.traceApi.recordRunFailed(sessionId, runId, "execution_validation_failed", "failed", stepIndex);
      return {
        type: "failed",
        result: this.resultBuilder.buildFailureFromValidation("execution_validation_failed", stepIndex, validatedExecutionResult),
      };
    }

    return {
      type: "validated",
      executionResult: validatedExecutionResult.value,
    };
  }

  private validateExecutionResult(
    context: AgentContext,
    plan: ExecutionPlan,
    executionResult: ExecutionResult,
  ): ValidationResult<ExecutionResult> {
    let validatedExecutionResult = this.executionResultValidator.validate(
      executionResult,
      context.request.responseFormat,
      plan.intent,
    );
    if (validatedExecutionResult.ok && validatedExecutionResult.value) {
      return validatedExecutionResult;
    }

    const repairedExecutionResult = repairExecutionResult(
      plan,
      executionResult,
      context.request.responseFormat,
    );
    if (!repairedExecutionResult) {
      return validatedExecutionResult;
    }

    return this.executionResultValidator.validate(
      repairedExecutionResult,
      context.request.responseFormat,
      plan.intent,
    );
  }

  private async observeStep(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    plan: ExecutionPlan,
    executionResult: ExecutionResult,
    state: AgentLoopState,
  ): Promise<RunStepResult> {
    const sessionId = context.runtimeContext.sessionId;

    if (executionResult.toolResults?.length) {
      state.collectedToolResults.push(
        ...executionResult.toolResults.map((toolResult) => ({
          ...toolResult,
          metadata: toolResult.metadata ? { ...toolResult.metadata } : undefined,
        })),
      );
    }

    await this.traceApi.recordObserveStarted(sessionId, runId, plan, executionResult);
    const observation = await this.observer.observe(context, plan, executionResult);
    await this.traceApi.recordObservationFinished(sessionId, runId, stepIndex, observation);

    const validatedObservation = this.observationValidator.validate(observation);
    if (!validatedObservation.ok || !validatedObservation.value) {
      if (stepIndex < this.maxSteps) {
        await this.traceApi.recordValidationFailed(
          sessionId,
          runId,
          stepIndex,
          "observation",
          "replan",
          validatedObservation.issues ?? [],
        );
        return {
          type: "continue",
          observation: buildRepairObservation(
            "Observation validation failed. Re-plan with validation issues.",
            validatedObservation.issues ?? [],
          ),
        };
      }
      await this.traceApi.recordValidationFailed(
        sessionId,
        runId,
        stepIndex,
        "observation",
        "fail",
        validatedObservation.issues ?? [],
      );
      await this.traceApi.recordRunFailed(sessionId, runId, "observation_validation_failed", "failed", stepIndex);
      return {
        type: "failed",
        result: this.resultBuilder.buildFailureFromValidation("observation_validation_failed", stepIndex, validatedObservation),
      };
    }

    state.priorStepResults.push(executionResult);
    state.lastObservation = validatedObservation.value;
    state.lastResult = this.buildStepResult(
      plan,
      executionResult,
      validatedObservation.value,
      state.collectedToolResults,
    );

    if (plan.completed || validatedObservation.value.completed) {
      await this.traceApi.recordRunFinished(sessionId, runId, stepIndex, validatedObservation.value);
      return {
        type: "completed",
        result: state.lastResult,
      };
    }

    return {
      type: "continue",
      observation: validatedObservation.value,
    };
  }

  private buildStepResult(
    plan: ExecutionPlan,
    executionResult: ExecutionResult,
    observation: ObservationResult,
    collectedToolResults: McpToolResult[],
  ): AgentRuntimeResult {
    const input = {
      executionResult,
      observation,
      toolResults: collectedToolResults,
      summary: observation.summary,
      stopReason: observation.completed ? "completed" : "failed",
      lastStepIndex: plan.stepIndex,
      diagnostics: observation.issues,
    } as const;
    return observation.accepted
      ? this.resultBuilder.buildSuccess(input)
      : this.resultBuilder.buildFailure(input);
  }

  private async buildMaxStepsResult(
    sessionId: string,
    runId: string,
    lastResult?: AgentRuntimeResult,
  ): Promise<AgentRuntimeResult> {
    await this.traceApi.recordRunFailed(
      sessionId,
      runId,
      "Runtime loop stopped after reaching the max step limit.",
      "max_steps",
      this.maxSteps,
    );

    const maxStepsResult = this.resultBuilder.buildFailure({
      summary: "Runtime loop stopped after reaching the max step limit.",
      stopReason: "max_steps",
      lastStepIndex: this.maxSteps,
      diagnostics: [
        {
          code: "max_steps_reached",
          message: "Runtime loop stopped after reaching the max step limit.",
          severity: "medium",
        },
      ],
    });

    if (!lastResult) {
      return maxStepsResult;
    }

    return {
      ...maxStepsResult,
      payload: {
        ...lastResult.payload,
        summary: maxStepsResult.payload.summary,
        stopReason: "max_steps",
        lastStepIndex: this.maxSteps,
      },
      diagnostics: maxStepsResult.diagnostics,
    };
  }
}

type AgentLoopState = {
  lastObservation?: ObservationResult;
  lastResult?: AgentRuntimeResult;
  priorStepResults: ExecutionResult[];
  collectedToolResults: McpToolResult[];
};

type RunStepResult =
  | {
      type: "continue";
      observation: ObservationResult;
    }
  | {
      type: "failed";
      result: AgentRuntimeResult;
    }
  | {
      type: "completed";
      result: AgentRuntimeResult;
    };

type StepExecutionOutcome =
  | {
      type: "continue";
      observation: ObservationResult;
    }
  | {
      type: "failed";
      result: AgentRuntimeResult;
    }
  | {
      type: "validated";
      executionResult: ExecutionResult;
    };

function buildRepairObservation(summary: string, issues: ValidationIssue[]): ObservationResult {
  return {
    accepted: false,
    completed: false,
    summary,
    issues,
    continueReason: summary,
  };
}

function buildExecutionErrorIssue(error: unknown): ValidationIssue {
  if (error instanceof ProviderExecutionError) {
    return {
      code: error.code,
      message: error.message,
      severity: "high",
    };
  }

  return {
    code: "execution_error",
    message: error instanceof Error ? error.message : String(error),
    severity: "high",
  };
}

function buildPlanningErrorIssue(error: unknown): ValidationIssue {
  if (error instanceof ProviderExecutionError) {
    return {
      code: error.code,
      message: error.message,
      severity: "high",
    };
  }

  return {
    code: "planning_error",
    message: error instanceof Error ? error.message : String(error),
    severity: "high",
  };
}

function repairExecutionResult(
  plan: ExecutionPlan,
  result: ExecutionResult,
  expectedResponseFormat: "text" | "json",
): ExecutionResult | undefined {
  if (!result.content.trim()) {
    return undefined;
  }

  if (expectedResponseFormat !== "json") {
    return {
      ...result,
      responseFormat: expectedResponseFormat,
    };
  }

  const repairedJson = extractJsonLikeContent(result.content);
  if (repairedJson) {
    return {
      ...result,
      content: repairedJson,
      responseFormat: "json",
    };
  }

  if (plan.intent === "chat" && plan.mode === "direct_generation") {
    return {
      ...result,
      content: JSON.stringify({
        answer: result.content.trim(),
      }),
      responseFormat: "json",
    };
  }

  return undefined;
}

function createRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
