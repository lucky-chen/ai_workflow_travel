import type { McpGateway, McpToolRegistry } from "../../capability/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { AgentRunInput, AgentRunResult, IAgent } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import { BaseAgent } from "../base_agent.js";
import { asNumber } from "../agent_parsing.js";
import { ExecutionStep } from "./peo_execution_step.js";
import { PEO_STAGE_COUNT, PlanStep } from "./peo_plan_step.js";
import { ObserveStep } from "./peo_observe_step.js";
import type { ExecutionStepResult } from "./peo_types.js";
import { DirectTaskExecutor, ReactTaskExecutor } from "./peo_task_executor.js";
import { createReActAgent } from "../react_agent/index.js";

class PEOAgent extends BaseAgent {
  constructor(
    private readonly planStep: PlanStep,
    private readonly executionStep: ExecutionStep,
    private readonly observeStep: ObserveStep,
    eventBus: RuntimeEventBus,
  ) {
    super("peo", eventBus);
  }

  protected async execute(input: AgentRunInput, runId: string): Promise<AgentRunResult> {
    let toolCalls = 0;
    let failedToolCalls = 0;
    const state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    } = { priorExecutionSummaries: [] };
    try {
      for (let stepIndex = 1; stepIndex <= PEO_STAGE_COUNT; stepIndex += 1) {
        const plan = await this.planStep.run(input, runId, stepIndex, state);
        const execution = await this.executionStep.run(input, runId, stepIndex, plan);
        for (const taskExecution of execution.taskExecutions) {
          toolCalls += asNumber(taskExecution.executionFacts?.toolCalls);
          failedToolCalls += asNumber(taskExecution.executionFacts?.failedToolCalls);
        }
        state.priorExecutionSummaries.push(summarizeExecutionResult(execution));
        const observation = await this.observeStep.run(input, runId, stepIndex, {
          plan,
          executionResult: execution,
          priorObservation: state.lastObservation?.summary,
        });
        state.lastObservation = {
          summary: observation.summary,
          finalAnswer: observation.finalAnswer,
        };
        if (observation.completed) {
          return createPeoSuccessResult("peo", input, runId, plan.planSummary, observation.finalAnswer, toolCalls, failedToolCalls);
        }
      }
      return createPeoMaxStepResult("peo", input, runId, toolCalls, failedToolCalls, state);
    } catch (error) {
      return createPeoFailureResult("peo", input, runId, error, toolCalls, failedToolCalls);
    }
  }
}

export function createPEOAgent(input: {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  eventBus: RuntimeEventBus;
  toolRegistry: McpToolRegistry;
  sysPrompt: string[];
}): IAgent {
  const internalReactAgent = createReActAgent({
    modelFactory: input.modelFactory,
    gateway: input.gateway,
    eventBus: input.eventBus,
    toolRegistry: input.toolRegistry,
    sysPrompt: input.sysPrompt,
  });
  return new PEOAgent(
    new PlanStep(input.modelFactory, input.eventBus, input.toolRegistry, input.sysPrompt),
    new ExecutionStep(
      input.eventBus,
      new DirectTaskExecutor(),
      new ReactTaskExecutor(internalReactAgent),
    ),
    new ObserveStep(input.eventBus),
    input.eventBus,
  );
}

function createPeoSuccessResult(
  _pattern: "peo",
  _input: AgentRunInput,
  _runId: string,
  _planContent: string,
  observeContent: string,
  _toolCalls: number,
  _failedToolCalls: number,
): AgentRunResult {
  return {
    content: observeContent,
    format: "text",
    metrics: {
      toolUsage: {
        toolCalls: _toolCalls,
        failedToolCalls: _failedToolCalls,
      },
    },
  };
}

function createPeoFailureResult(
  _pattern: "peo",
  _input: AgentRunInput,
  _runId: string,
  error: unknown,
  _toolCalls: number,
  _failedToolCalls: number,
): AgentRunResult {
  return {
    format: "text",
    errorInfo: {
      code: "PEO_AGENT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
    metrics: {
      toolUsage: {
        toolCalls: _toolCalls,
        failedToolCalls: _failedToolCalls,
      },
    },
  };
}

function createPeoMaxStepResult(
  _pattern: "peo",
  _input: AgentRunInput,
  _runId: string,
  _toolCalls: number,
  _failedToolCalls: number,
  state: {
    lastObservation?: { summary: string; finalAnswer?: string };
  },
): AgentRunResult {
  return {
    format: "text",
    errorInfo: {
      code: "PEO_AGENT_MAX_STEPS",
      message: "PEO agent stopped after reaching the max step limit.",
    },
    metrics: {
      toolUsage: {
        toolCalls: _toolCalls,
        failedToolCalls: _failedToolCalls,
      },
    },
  };
}

function summarizeExecutionResult(result: ExecutionStepResult): string {
  if (result.tasks.length > 0) {
    return result.tasks
      .map((task, index) => `${task.taskId}:${result.taskExecutions[index]?.output ?? result.taskExecutions[index]?.error?.message ?? ""}`)
      .join("|");
  }
  return result.finalAnswer ?? result.planSummary;
}
