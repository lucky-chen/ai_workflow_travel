import { PlanningPromptBuilder } from "../loop/planning-prompt-builder.js";
import type {
  AgentContext,
  ExecutionPlan,
  IModelBackend,
  IPlanner,
  PlannerLoopState,
  RequestIntent,
} from "./agent-runtime-types.js";
import { parseJsonLikeContent } from "./json-content.js";

export class DefaultPlanner implements IPlanner {
  constructor(
    private readonly backend: IModelBackend,
    private readonly availableTools: string[] = [],
    private readonly promptBuilder: PlanningPromptBuilder = new PlanningPromptBuilder(),
  ) {}

  async plan(context: AgentContext, loopState?: PlannerLoopState): Promise<ExecutionPlan> {
    const request = this.buildPlanningRequest(context, loopState);
    const result = await this.backend.execute(request);
    return parseExecutionPlan(result.content, loopState?.stepIndex ?? 1, result.traceFacts);
  }

  private buildPlanningRequest(context: AgentContext, loopState?: PlannerLoopState) {
    return this.promptBuilder.build({
      context,
      availableTools: this.availableTools,
      priorStepResults: loopState?.priorStepResults,
      priorObservation: loopState?.priorObservation,
      stepIndex: loopState?.stepIndex,
      repairPhase: loopState?.repairPhase,
      repairIssues: loopState?.repairIssues,
    });
  }
}

function parseExecutionPlan(
  content: string,
  stepIndex: number,
  traceFacts?: ExecutionPlan["traceFacts"],
): ExecutionPlan {
  const parsed = parsePlannerContent(content);
  const normalized = normalizeExecutionPlanShape(parsed, stepIndex);
  return finalizeExecutionPlan(normalized, stepIndex, traceFacts);
}

function parsePlannerContent(content: string): Record<string, unknown> {
  return asRecord(parseJsonLikeContent(content));
}

function normalizeExecutionPlanShape(
  parsed: Record<string, unknown>,
  stepIndex: number,
): Partial<ExecutionPlan> {
  const directShape = normalizeDirectExecutionPlanShape(parsed, stepIndex);
  if (directShape) {
    return directShape;
  }

  return normalizeNestedExecutionPlanShape(parsed, stepIndex);
}

function normalizeDirectExecutionPlanShape(
  parsed: Record<string, unknown>,
  stepIndex: number,
): Partial<ExecutionPlan> | undefined {
  if (
    typeof parsed.mode !== "string" &&
    typeof parsed.summary !== "string" &&
    typeof parsed.nextStepGoal !== "string"
  ) {
    return undefined;
  }

  return {
    intent: isRequestIntent(parsed.intent) ? parsed.intent : undefined,
    mode: isExecutionMode(parsed.mode) ? parsed.mode : undefined,
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    stepIndex: typeof parsed.stepIndex === "number" ? parsed.stepIndex : stepIndex,
    nextStepGoal: typeof parsed.nextStepGoal === "string" ? parsed.nextStepGoal : undefined,
    completed: typeof parsed.completed === "boolean" ? parsed.completed : undefined,
    stopReason: isStopReason(parsed.stopReason) ? parsed.stopReason : undefined,
    toolSteps: normalizeToolSteps(parsed.toolSteps),
  };
}

function normalizeNestedExecutionPlanShape(
  parsed: Record<string, unknown>,
  stepIndex: number,
): Partial<ExecutionPlan> {
  const executionPlan = parsed.executionPlan;
  if (!executionPlan || typeof executionPlan !== "object") {
    return {};
  }

  const steps = asRecord(executionPlan).steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return {};
  }

  const firstStep = asRecord(steps[0]);
  if (Object.keys(firstStep).length === 0) {
    return {};
  }

  const action = firstStep.action;
  const parameters = firstStep.parameters;

  if (action === "sendResponse") {
    return {
      intent: "chat",
      mode: "direct_generation",
      summary: "Send final response.",
      stepIndex,
      nextStepGoal: "Generate final response.",
      completed: true,
      stopReason: "completed",
    };
  }

  if (action === "callTool" && parameters && typeof parameters === "object") {
    const parameterRecord = asRecord(parameters);
    const toolName = parameterRecord.toolName;
    const toolArguments = parameterRecord.arguments;
    return {
      intent: "task",
      mode: "tool_augmented_generation",
      summary: "Call tool before continuing.",
      stepIndex,
      nextStepGoal: "Use tool results for the next response.",
      completed: false,
      ...(typeof toolName === "string"
        ? {
            toolSteps: [
              {
                toolCallId: "",
                toolName,
                arguments: isRecord(toolArguments) ? toolArguments : {},
              },
            ],
          }
        : {}),
    };
  }

  return {};
}

function finalizeExecutionPlan(
  normalized: Partial<ExecutionPlan>,
  stepIndex: number,
  traceFacts?: ExecutionPlan["traceFacts"],
): ExecutionPlan {
  return {
    intent: normalized.intent ?? inferIntent(normalized),
    mode: normalized.mode ?? "direct_generation",
    summary: normalized.summary ?? "",
    stepIndex: normalized.stepIndex ?? stepIndex,
    nextStepGoal: normalized.nextStepGoal ?? "",
    ...(traceFacts ? { traceFacts } : {}),
    ...(normalized.completed !== undefined ? { completed: normalized.completed } : {}),
    ...(normalized.stopReason ? { stopReason: normalized.stopReason } : {}),
    ...(normalized.toolSteps ? { toolSteps: assignToolCallIds(normalized.toolSteps, normalized.stepIndex ?? stepIndex) } : {}),
  };
}

function normalizeToolSteps(value: unknown): ExecutionPlan["toolSteps"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => normalizeToolStep(item))
    .filter((item): item is NonNullable<ExecutionPlan["toolSteps"]>[number] => item !== undefined);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeToolStep(value: unknown): NonNullable<ExecutionPlan["toolSteps"]>[number] | undefined {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) {
    return undefined;
  }

  const toolName = typeof record.toolName === "string"
    ? record.toolName
    : typeof record.tool === "string"
      ? record.tool
      : undefined;
  const argumentsValue = isRecord(record.arguments)
    ? record.arguments
    : isRecord(record.parameters)
      ? record.parameters
      : {};

  if (!toolName) {
    return undefined;
  }

  return {
    toolCallId: typeof record.toolCallId === "string" ? record.toolCallId : "",
    toolName,
    arguments: argumentsValue,
  };
}

function assignToolCallIds(
  toolSteps: NonNullable<ExecutionPlan["toolSteps"]>,
  stepIndex: number,
): NonNullable<ExecutionPlan["toolSteps"]> {
  return toolSteps.map((toolStep, toolIndex) => ({
    ...toolStep,
    toolCallId: toolStep.toolCallId.trim() || `step-${stepIndex}-tool-${toolIndex + 1}`,
  }));
}

function isExecutionMode(value: unknown): value is ExecutionPlan["mode"] {
  return value === "direct_generation" || value === "tool_augmented_generation";
}

function isRequestIntent(value: unknown): value is RequestIntent {
  return value === "chat" || value === "task";
}

function isStopReason(value: unknown): value is NonNullable<ExecutionPlan["stopReason"]> {
  return value === "completed" || value === "max_steps" || value === "cancelled" || value === "failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function inferIntent(plan: Partial<ExecutionPlan>): RequestIntent {
  if (plan.mode === "tool_augmented_generation" || (plan.toolSteps?.length ?? 0) > 0) {
    return "task";
  }

  return "chat";
}
