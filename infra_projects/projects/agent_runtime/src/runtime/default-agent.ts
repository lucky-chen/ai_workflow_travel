import { AgentTraceApi } from "./agent-trace-api.js";
import type { IAgentTraceRecorder } from "./agent-trace-recorder.js";
import type {
  AgentContext,
  AgentRuntimeResult,
  IAgent,
  IExecutor,
  IObserver,
  IPlanner,
  ObservationResult,
  ValidationResult,
} from "./agent-runtime-types.js";
import type { PlanValidator } from "../loop/plan-validator.js";
import type { ExecutionResultValidator } from "../loop/execution-result-validator.js";
import type { ObservationValidator } from "../loop/observation-validator.js";

export class DefaultAgent implements IAgent {
  private readonly traceApi: AgentTraceApi;

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
    const runId = getRunId(context);
    const sessionId = context.runtimeContext.sessionId;
    let lastObservation: ObservationResult | undefined;
    let lastResult: AgentRuntimeResult | undefined;
    const priorStepResults = [];

    await this.traceApi.recordRunStarted(sessionId, runId);

    for (let stepIndex = 1; stepIndex <= this.maxSteps; stepIndex += 1) {
      const plan = await this.planner.plan(context, {
        stepIndex,
        priorStepResults,
        priorObservation: lastObservation,
      });
      await this.traceApi.recordPlanGenerated(sessionId, runId, plan);

      const validatedPlan = this.planValidator.validate(plan);
      if (!validatedPlan.ok || !validatedPlan.value) {
        await this.traceApi.recordValidationFailed(sessionId, runId, validatedPlan.issues ?? []);
        return buildValidationFailureResult("plan_validation_failed", stepIndex, validatedPlan);
      }

      const executionResult = await this.executor.execute(context, validatedPlan.value);
      await this.traceApi.recordToolResults(sessionId, runId, executionResult.toolResults);
      await this.traceApi.recordExecutionFinished(sessionId, runId, executionResult);

      const validatedExecutionResult = this.executionResultValidator.validate(
        executionResult,
        context.request.responseFormat,
      );
      if (!validatedExecutionResult.ok || !validatedExecutionResult.value) {
        await this.traceApi.recordValidationFailed(sessionId, runId, validatedExecutionResult.issues ?? []);
        return buildValidationFailureResult("execution_validation_failed", stepIndex, validatedExecutionResult);
      }

      const observation = await this.observer.observe(context, validatedPlan.value, validatedExecutionResult.value);
      await this.traceApi.recordObservationFinished(sessionId, runId, observation);

      const validatedObservation = this.observationValidator.validate(observation);
      if (!validatedObservation.ok || !validatedObservation.value) {
        await this.traceApi.recordValidationFailed(sessionId, runId, validatedObservation.issues ?? []);
        return buildValidationFailureResult("observation_validation_failed", stepIndex, validatedObservation);
      }

      priorStepResults.push(validatedExecutionResult.value);
      lastObservation = validatedObservation.value;
      lastResult = {
        status: validatedObservation.value.accepted ? "success" : "failed",
        payload: {
          content: validatedExecutionResult.value.content,
          responseFormat: validatedExecutionResult.value.responseFormat,
          toolResults: validatedExecutionResult.value.toolResults,
          accepted: validatedObservation.value.accepted,
          completed: validatedObservation.value.completed,
          summary: validatedObservation.value.summary,
          stopReason: validatedObservation.value.completed ? "completed" : undefined,
          lastStepIndex: validatedPlan.value.stepIndex,
        },
        diagnostics: validatedObservation.value.issues,
      };

      if (validatedPlan.value.completed || validatedObservation.value.completed) {
        await this.traceApi.recordRunFinished(sessionId, runId, validatedObservation.value);
        return lastResult;
      }
    }

    await this.traceApi.recordRunFinished(sessionId, runId, {
      accepted: false,
      completed: false,
      summary: "Runtime loop stopped after reaching the max step limit.",
      issues: [
        {
          code: "max_steps_reached",
          message: "Runtime loop stopped after reaching the max step limit.",
          severity: "medium",
        },
      ],
      continueReason: "max_steps",
    });

    return (
      lastResult ?? {
        status: "failed",
        payload: {
          completed: false,
          summary: "Runtime loop stopped after reaching the max step limit.",
          stopReason: "max_steps",
          lastStepIndex: this.maxSteps,
        },
        diagnostics: [
          {
            code: "max_steps_reached",
            message: "Runtime loop stopped after reaching the max step limit.",
            severity: "medium",
          },
        ],
      }
    );
  }
}

function getRunId(context: AgentContext): string {
  const requestId = context.request.metadata?.requestId;
  return requestId && requestId.trim().length > 0 ? requestId : "agent-run";
}

function buildValidationFailureResult(
  code: string,
  stepIndex: number,
  validation: ValidationResult<unknown>,
): AgentRuntimeResult {
  return {
    status: "failed",
    payload: {
      completed: false,
      summary: code,
      stopReason: "failed",
      lastStepIndex: stepIndex,
    },
    diagnostics: validation.issues,
  };
}
