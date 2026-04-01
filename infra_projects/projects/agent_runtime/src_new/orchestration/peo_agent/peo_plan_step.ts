import type { McpToolRegistry } from "../../capability/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import {
  createContextBasis,
  ensureSuccessfulModelResponse,
  getRuntimeContext,
  isRecord,
  summarizeModuleRequest,
  summarizeModuleResponse,
  summarizeToolDefinitions,
  tryParseJsonRecord,
} from "../agent_orchestration_helpers.js";
import type { PlanStepResult, PlanTask } from "./peo_types.js";

export const PEO_STAGE_COUNT = 3;

export class PlanStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly eventBus: RuntimeEventBus,
    private readonly toolRegistry: McpToolRegistry,
  ) {}

  async run(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    },
  ): Promise<PlanStepResult> {
    const request = await this.buildPrompt(context, stepIndex, state);
    const response = await this.executeModel(context, runId, stepIndex, request);
    return this.check({ content: response.content });
  }

  private async buildPrompt(
    context: AgentContext,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    },
  ): Promise<ModuleRequest> {
    const runtimeContext = getRuntimeContext(context);
    const toolDefinitions = await this.toolRegistry.listToolDefinitions();
    return {
      systemPrompt: [
        "You are the plan stage inside the PEO agent.",
        "Return valid JSON only.",
        "Return one plan result object only.",
        "Produce high-level plan tasks only. Do not output direct tool calls.",
        "Set task type to react when the task requires tool-oriented sub-problem solving.",
        "Set task type to direct when the task is bounded direct work without a tool loop.",
        "Do not add fields outside the contract.",
      ],
      responseFormat: "json",
      userPrompt: {
        stage: "peo_plan",
        question: runtimeContext.userInput.content,
        contextBasis: createContextBasis({
          context,
          priorObservation: state.lastObservation?.summary,
          priorExecutionSummaries: state.priorExecutionSummaries,
        }),
        tools: {
          availableTools: summarizeToolDefinitions(toolDefinitions),
          taskTypeRules: [
            "Use task type react for tool-oriented sub-problems.",
            "Use task type direct for bounded direct work.",
            "Keep tasks abstract and do not output direct toolCall payloads.",
          ],
        },
        expectedSchema: {
          planSummary: "required string",
          tasks: "required array",
          finalAnswer: "string optional",
        },
        runtimeState: {
          stepIndex,
          maxStages: PEO_STAGE_COUNT,
        },
      },
      stream: false,
    };
  }

  private async check(plan: Record<string, unknown>): Promise<PlanStepResult> {
    const content = typeof plan.content === "string" ? plan.content : "";
    if (!content.trim()) {
      throw new Error("PEO plan is empty.");
    }
    const parsed = tryParseJsonRecord(content);
    const tasks = Array.isArray(parsed?.tasks)
      ? parsed.tasks
        .map((value, index) => normalizePlanTask(value, index))
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
      : [];
    const planSummary = typeof parsed?.planSummary === "string" && parsed.planSummary.trim()
      ? parsed.planSummary
      : typeof parsed?.plan === "string" && parsed.plan.trim()
        ? parsed.plan
        : content;
    return {
      planSummary,
      tasks: tasks.length > 0
        ? tasks
        : typeof parsed?.finalAnswer === "string"
          ? []
          : [{
              taskId: "task-1",
              description: planSummary,
              type: "direct",
              status: "pending",
            }],
      finalAnswer: typeof parsed?.finalAnswer === "string" ? parsed.finalAnswer : undefined,
    };
  }

  private async executeModel(
    context: AgentContext,
    runId: string,
    stepIndex: number,
    request: ModuleRequest,
  ) {
    const runtimeContext = getRuntimeContext(context);
    const model = this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
    await this.eventBus.publish({
      type: "model_started",
      metadata: {
        sessionId: runtimeContext.sessionId,
        traceId: runId,
        timestamp: new Date().toISOString(),
      },
      agent: {
        name: "peo",
        peo: {
          step: "plan",
          stepIndex,
        },
      },
    });
    try {
      const response = await model.execute(request);
      ensureSuccessfulModelResponse(response);
      await this.eventBus.publish({
        type: "model_completed",
        metadata: {
          sessionId: runtimeContext.sessionId,
          traceId: runId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          name: "peo",
          peo: {
            step: "plan",
            stepIndex,
          },
        },
      });
      return response;
    } catch (error) {
      const response = error && typeof error === "object" && "content" in error && "error" in error
        ? error as { content: string; error: { code: string; message: string } }
        : undefined;
      await this.eventBus.publish({
        type: "model_completed",
        metadata: {
          sessionId: runtimeContext.sessionId,
          traceId: runId,
          timestamp: new Date().toISOString(),
        },
        agent: {
          name: "peo",
          peo: {
            step: "plan",
            stepIndex,
          },
        },
        custom: {
          requestSummary: summarizeModuleRequest(request),
          responseSummary: response ? summarizeModuleResponse(response) : undefined,
          error: {
            code: response?.error.code ?? "MODEL_CALL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });
      throw error;
    }
  }
}

function normalizePlanTask(value: unknown, index: number): PlanTask | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const description = typeof value.description === "string" && value.description.trim()
    ? value.description
    : undefined;
  if (!description) {
    return undefined;
  }
  return {
    taskId: typeof value.taskId === "string" && value.taskId.trim() ? value.taskId : `task-${index + 1}`,
    description,
    type: value.type === "react" ? "react" : "direct",
    status: value.status === "completed" || value.status === "failed" || value.status === "blocked"
      ? value.status
      : "pending",
    dependsOn: Array.isArray(value.dependsOn)
      ? value.dependsOn.filter((dependency): dependency is string => typeof dependency === "string")
      : undefined,
  };
}
