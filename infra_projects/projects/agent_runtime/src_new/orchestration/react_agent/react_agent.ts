import { randomUUID } from "node:crypto";

import type { McpGateway, McpToolRegistry } from "../../capability/types.js";
import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { Trace } from "../../observability/trace.js";
import type { AgentRuntimeResult, IAgent } from "../types.js";
import {
  asNumber,
  createAssistantTranscriptTurn,
  createBaseTranscript,
  createToolTranscriptTurn,
  getRequestedToolName,
  getRuntimeContext,
} from "../agent_orchestration_helpers.js";
import { ActionStep } from "./react_action_step.js";
import { ObservationStep } from "./react_observation_step.js";
import { REACT_MAX_STEPS, ThoughtStep } from "./react_thought_step.js";

class ReActAgent implements IAgent {
  readonly pattern = "react" as const;
  private running = false;

  constructor(
    private readonly thoughtStep: ThoughtStep,
    private readonly actionStep: ActionStep,
    private readonly observationStep: ObservationStep,
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
      priorActionSummaries: string[];
    } = { priorActionSummaries: [] };
    try {
      const transcriptAppend = createBaseTranscript(context);
      for (let stepIndex = 1; stepIndex <= REACT_MAX_STEPS; stepIndex += 1) {
        const thought = await this.thoughtStep.run(context, runId, stepIndex, state);
        const action = await this.actionStep.run(context, runId, stepIndex, thought);
        toolCalls += asNumber(action.toolCalls);
        failedToolCalls += asNumber(action.failedToolCalls);
        if (thought.actionType === "tool" && action.observation) {
          transcriptAppend.push(createToolTranscriptTurn(action.observation));
        }
        state.priorActionSummaries.push(action.observation);
        const observation = await this.observationStep.run(context, runId, stepIndex, {
          thought: thought.thought,
          actionType: thought.actionType,
          actionObservation: action.observation,
          priorObservation: state.lastObservation?.summary,
          shouldContinue: action.shouldContinue,
          finalAnswer: action.finalAnswer,
        });
        state.lastObservation = {
          summary: observation.summary,
          finalAnswer: observation.finalAnswer,
        };
        if (observation.completed) {
          transcriptAppend.push(createAssistantTranscriptTurn(observation.finalAnswer));
          return createReactSuccessResult(this.pattern, context, runId, observation.finalAnswer, transcriptAppend, toolCalls, failedToolCalls);
        }
      }
      return createReactMaxStepResult(this.pattern, context, runId, createBaseTranscript(context), toolCalls, failedToolCalls, state);
    } catch (error) {
      return createReactFailureResult(this.pattern, context, runId, error, toolCalls, failedToolCalls);
    } finally {
      this.running = false;
    }
  }
}

export function createReActAgent(input: {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  trace: Trace;
  toolRegistry: McpToolRegistry;
}): IAgent {
  return new ReActAgent(
    new ThoughtStep(input.modelFactory, input.trace, input.toolRegistry),
    new ActionStep(input.gateway),
    new ObservationStep(input.modelFactory, input.trace),
  );
}

function createReactSuccessResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  content: string,
  transcriptAppend: AgentRuntimeResult["stateUpdate"]["transcriptAppend"],
  toolCalls: number,
  failedToolCalls: number,
): AgentRuntimeResult {
  return {
    traceId: runId,
    content: {
      data: content,
      format: "text",
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend,
      runtimeMemorySummaryItems: [
        { summary: `react:${getRequestedToolName(context) ?? "no-tool"}` },
      ],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
    },
  };
}

function createReactFailureResult(
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
      code: "REACT_AGENT_FAILED",
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

function createReactMaxStepResult(
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
      code: "REACT_AGENT_MAX_STEPS",
      message: "ReAct agent stopped after reaching the max step limit.",
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend,
      runtimeMemorySummaryItems: state.lastObservation?.summary
        ? [{ summary: `react:${state.lastObservation.summary.slice(0, 64)}` }]
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
