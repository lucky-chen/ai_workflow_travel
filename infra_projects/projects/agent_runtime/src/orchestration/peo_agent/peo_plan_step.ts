import type { McpToolRegistry } from "../../capability/types.js";
import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest } from "../../model/types.js";
import {
  ensureSuccessfulModelResponse,
  isRecord,
  summarizeToolDefinitions,
  tryParseJsonRecord,
} from "../agent_parsing.js";
import type { PlanStepResult, PlanTask, Summary } from "./peo_types.js";

export const PEO_STAGE_COUNT = 3;

export class PlanStep {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly toolRegistry: McpToolRegistry,
    private readonly sysPrompt: string[],
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    state: {
      lastObservation?: { summary: Summary };
    },
  ): Promise<PlanStepResult> {
    const request = this.buildPrompt(input, stepIndex, state);
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "peo.plan.input",
      details: {
        runId,
        agent: "peo",
        step: "plan",
        stepIndex,
        input: request.userPrompt,
      },
    });
    const response = await this.executeModel(input, runId, stepIndex, request);
    const checked = await this.check({ content: response.content });
    return checked;
  }

  private buildPrompt(
    input: AgentRunInput,
    stepIndex: number,
    state: {
      lastObservation?: { summary: Summary };
    },
  ): ModuleRequest {
    const toolDefinitions = this.toolRegistry.listToolDefinitions();
    return {
      systemPrompt: this.sysPrompt.concat([
        "You are the plan stage inside the PEO agent.",
        "Return valid JSON only.",
        "Return one plan result object only.",
        "Analyze the problem and split it into executable sub-problems only.",
        "Each task must be a concrete sub-problem that a ReAct-style child agent can directly handle.",
        "Use tasks for investigation, verification, reading, searching, editing, or other executable work.",
        "Do not output direct tool calls.",
        "Do not create reply tasks, final-answer tasks, or any task whose purpose is to respond to the user.",
        "Return tasks in execution order.",
        "Do not add fields outside the contract.",
      ]),
      responseFormat: "json",
      userPrompt: {
        stage: "peo_plan",
        question: input.userInput,
        priorObservation: state.lastObservation?.summary,
        tools: {
          availableTools: summarizeToolDefinitions(toolDefinitions),
          taskTypeRules: [
            "Keep tasks abstract and do not output direct toolCall payloads.",
            "Return tasks in execution order.",
          ],
        },
        responseContract: {
          planSummary: "required string",
          tasks: {
            type: "required array<PlanTask>",
            itemSchema: {
              name: "required string",
              description: "required string",
            },
          },
        },
        runtimeState: {
          stepIndex,
          maxStages: PEO_STAGE_COUNT,
        },
      },
      stream: false,
    };
  }

  private check(plan: Record<string, unknown>): Promise<PlanStepResult> {
    const content = typeof plan.content === "string" ? plan.content : "";
    const fallbackSummary = content.trim() || "PEO plan validation failed.";
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
        : fallbackSummary;
    if (!content.trim()) {
      return Promise.resolve({
        planSummary,
        tasks: [],
        validationError: "PEO plan is empty.",
      });
    }
    if (Array.isArray(parsed?.tasks) && tasks.length === 0) {
      return Promise.resolve({
        planSummary,
        tasks: [],
      });
    }
    if (!Array.isArray(parsed?.tasks)) {
      return Promise.resolve({
        planSummary,
        tasks: [],
        validationError: "PEO plan tasks are invalid.",
      });
    }
    return Promise.resolve({
      planSummary,
      tasks,
    });
  }

  private async executeModel(
    input: AgentRunInput,
    runId: string,
    stepIndex: number,
    request: ModuleRequest,
  ) {
    const model = await this.modelFactory.createDefaultModel();
    const response = await model.execute(request);
    ensureSuccessfulModelResponse(response);
    return response;
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
    name: typeof value.name === "string" && value.name.trim() ? value.name : `task-${index + 1}`,
    description,
  };
}
