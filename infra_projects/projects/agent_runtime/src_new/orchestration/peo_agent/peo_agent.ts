import { randomUUID } from "node:crypto";

import type { McpGateway, McpToolRegistry } from "../../capability/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { AgentRuntimeResult, IAgent } from "../types.js";
import {
  asNumber,
  createAssistantTranscriptTurn,
  createBaseTranscript,
  createToolTranscriptTurn,
  getRuntimeContext,
} from "../agent_orchestration_helpers.js";
import { ExecutionStep } from "./peo_execution_step.js";
import { PEO_STAGE_COUNT, PlanStep } from "./peo_plan_step.js";
import { ObserveStep } from "./peo_observe_step.js";
import type { ExecutionStepResult } from "./peo_types.js";
import { DirectTaskExecutor, ReactTaskExecutor } from "./peo_task_executor.js";
import { createReActAgent } from "../react_agent/index.js";

class PEOAgent implements IAgent {
  readonly pattern = "peo" as const;
  private running = false;

  constructor(
    private readonly planStep: PlanStep,
    private readonly executionStep: ExecutionStep,
    private readonly observeStep: ObserveStep,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async run(context: AgentContext): Promise<AgentRuntimeResult> {
    const runId = randomUUID();
    this.running = true;
    let toolCalls = 0;
    let failedToolCalls = 0;
    const state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorExecutionSummaries: string[];
    } = { priorExecutionSummaries: [] };
    try {
      const transcriptAppend = createBaseTranscript(context);
      for (let stepIndex = 1; stepIndex <= PEO_STAGE_COUNT; stepIndex += 1) {
        const plan = await this.planStep.run(context, runId, stepIndex, state);
        const execution = await this.executionStep.run(context, runId, stepIndex, plan);
        for (const taskExecution of execution.taskExecutions) {
          toolCalls += asNumber(taskExecution.executionFacts?.toolCalls);
          failedToolCalls += asNumber(taskExecution.executionFacts?.failedToolCalls);
          if (
            taskExecution.executionFacts?.toolCalls
            && typeof taskExecution.output === "string"
            && taskExecution.output.trim()
          ) {
            transcriptAppend.push(createToolTranscriptTurn(taskExecution.output));
          }
        }
        state.priorExecutionSummaries.push(summarizeExecutionResult(execution));
        const observation = await this.observeStep.run(context, runId, stepIndex, {
          plan,
          executionResult: execution,
          priorObservation: state.lastObservation?.summary,
        });
        state.lastObservation = {
          summary: observation.summary,
          finalAnswer: observation.finalAnswer,
        };
        if (observation.completed) {
          transcriptAppend.push(createAssistantTranscriptTurn(observation.finalAnswer));
          return createPeoSuccessResult(this.pattern, context, runId, plan.planSummary, observation.finalAnswer, transcriptAppend, toolCalls, failedToolCalls);
        }
      }
      return createPeoMaxStepResult(this.pattern, context, runId, createBaseTranscript(context), toolCalls, failedToolCalls, state);
    } catch (error) {
      return createPeoFailureResult(this.pattern, context, runId, error, toolCalls, failedToolCalls);
    } finally {
      this.running = false;
    }
  }
}

export function createPEOAgent(input: {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  eventBus: RuntimeEventBus;
  toolRegistry: McpToolRegistry;
}): IAgent {
  const internalReactAgent = createReActAgent({
    modelFactory: input.modelFactory,
    gateway: input.gateway,
    eventBus: input.eventBus,
    toolRegistry: input.toolRegistry,
  });
  return new PEOAgent(
    new PlanStep(input.modelFactory, input.eventBus, input.toolRegistry),
    new ExecutionStep(
      input.eventBus,
      new DirectTaskExecutor(),
      new ReactTaskExecutor(internalReactAgent),
    ),
    new ObserveStep(input.eventBus),
  );
}

function createPeoSuccessResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  planContent: string,
  observeContent: string,
  transcriptAppend: AgentRuntimeResult["stateUpdate"]["transcriptAppend"],
  toolCalls: number,
  failedToolCalls: number,
): AgentRuntimeResult {
  return {
    traceId: runId,
    content: {
      data: observeContent,
      format: "text",
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend,
      runtimeMemorySummaryItems: [
        { summary: `peo:${planContent.slice(0, 64)}` },
      ],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
    },
  };
}

function createPeoFailureResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  error: unknown,
  toolCalls: number,
  failedToolCalls: number,
): AgentRuntimeResult {
  return {
    traceId: runId,
    errorInfo: {
      code: "PEO_AGENT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend: createBaseTranscript(context),
      runtimeMemorySummaryItems: [],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
    },
  };
}

function createPeoMaxStepResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  transcriptAppend: AgentRuntimeResult["stateUpdate"]["transcriptAppend"],
  toolCalls: number,
  failedToolCalls: number,
  state: {
    lastObservation?: { summary: string; finalAnswer?: string };
  },
): AgentRuntimeResult {
  return {
    traceId: runId,
    errorInfo: {
      code: "PEO_AGENT_MAX_STEPS",
      message: "PEO agent stopped after reaching the max step limit.",
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend,
      runtimeMemorySummaryItems: state.lastObservation?.summary
        ? [{ summary: `peo:${state.lastObservation.summary.slice(0, 64)}` }]
        : [],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
    },
  };
}

function createAgentMetadata(pattern: IAgent["pattern"], context: AgentContext): AgentRuntimeResult["agent"] {
  return {
    prompt: {
      system: [],
      user: getRuntimeContext(context).userInput.content,
    },
    pattern,
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
