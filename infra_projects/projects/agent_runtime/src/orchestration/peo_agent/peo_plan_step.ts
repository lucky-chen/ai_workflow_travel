import type { McpToolRegistry } from "../../capability/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { AgentRunInput } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import {
  ensureSuccessfulModelResponse,
  isRecord,
  summarizeToolDefinitions,
  tryParseJsonRecord,
} from "../agent_parsing.js";
import type { PlanStepResult, PlanTask } from "./peo_types.js";

export const PEO_STAGE_COUNT = 3;

export class PlanStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly eventBus: RuntimeEventBus,
    private readonly toolRegistry: McpToolRegistry,
    private readonly sysPrompt: string[],
  ) {}

  async run(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    },
  ): Promise<PlanStepResult> {
    const request = await this.buildPrompt(input, stepIndex, state);
    await this.eventBus.publish({
      type: "agent",
      agentMessage: {
        event: "step",
        traceId: runId,
        timestamp: new Date().toISOString(),
        agent: {
          name: "peo",
          content: {
            step: "plan",
            stepIndex,
            input: request.userPrompt,
          },
        },
      },
    });
    const response = await this.executeModel(input, runId, stepIndex, request);
    const checked = await this.check({ content: response.content });
    return checked;
  }

  private async buildPrompt(
    input: AgentRunInput,
    stepIndex: number,
    state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    },
  ): Promise<ModuleRequest> {
    const toolDefinitions = await this.toolRegistry.listToolDefinitions();
    return {
      systemPrompt: this.sysPrompt.concat([
        "You are the plan stage inside the PEO agent.",
        "Return valid JSON only.",
        "Return one plan result object only.",
        "Produce high-level plan tasks only. Do not output direct tool calls.",
        "Set task type to react when the task requires tool-oriented sub-problem solving.",
        "Set task type to direct when the task is bounded direct work without a tool loop.",
        "Do not add fields outside the contract.",
      ]),
      responseFormat: "json",
      userPrompt: {
        stage: "peo_plan",
        question: input.userInput,
        priorObservation: state.lastObservation?.summary,
        priorExecutionSummaries: state.priorExecutionSummaries,
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
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    request: ModuleRequest,
  ) {
    const model = await this.modelFactory.createDefaultModel();
    try {
      const response = await model.execute(request);
      ensureSuccessfulModelResponse(response);
      return response;
    } catch (error) {
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
