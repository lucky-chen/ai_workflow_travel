import { randomUUID } from "node:crypto";

import type { McpGateway, McpToolRegistry } from "../../capability/types.js";
import type { AgentRunInput, AgentRunResult, IAgent } from "../../interface/agent-api.js";
import type { AgentRunMode } from "../../interface/api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";
import { asNumber } from "../agent_parsing.js";
import { ActionStep } from "./react_action_step.js";
import { ObservationStep } from "./react_observation_step.js";
import { REACT_MAX_STEPS, ThoughtStep } from "./react_thought_step.js";

class ReActAgent implements IAgent {
  private running = false;

  constructor(
    private readonly thoughtStep: ThoughtStep,
    private readonly actionStep: ActionStep,
    private readonly observationStep: ObservationStep,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  subscribeEvents(): void {}

  unsubscribeEvents(): void {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const runId = randomUUID();
    this.running = true;
    let toolCalls = 0;
    let failedToolCalls = 0;
    const state: {
      lastObservation?: { summary: string; finalAnswer?: string };
      priorActionSummaries: string[];
    } = { priorActionSummaries: [] };
    try {
      for (let stepIndex = 1; stepIndex <= REACT_MAX_STEPS; stepIndex += 1) {
        const thought = await this.thoughtStep.run(input, runId, stepIndex, state);
        const action = await this.actionStep.run(input, runId, stepIndex, thought);
        toolCalls += asNumber(action.toolCalls);
        failedToolCalls += asNumber(action.failedToolCalls);
        state.priorActionSummaries.push(action.observation);
        const observation = await this.observationStep.run(input, runId, stepIndex, {
          thought: thought.thought,
          actionType: thought.actionType,
          actionObservations: action.actionObservations,
          priorObservation: state.lastObservation?.summary,
          shouldContinue: action.shouldContinue,
          finalAnswer: action.finalAnswer,
        });
        state.lastObservation = {
          summary: observation.summary,
          finalAnswer: observation.finalAnswer,
        };
        if (observation.completed) {
          return createReactSuccessResult("react", input, runId, observation.finalAnswer, toolCalls, failedToolCalls);
        }
      }
      return createReactMaxStepResult("react", input, runId, toolCalls, failedToolCalls, state);
    } catch (error) {
      return createReactFailureResult("react", input, runId, error, toolCalls, failedToolCalls);
    } finally {
      this.running = false;
    }
  }
}

export function createReActAgent(input: {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  eventBus: RuntimeEventBus;
  toolRegistry: McpToolRegistry;
  sysPrompt: string[];
}): IAgent {
  return new ReActAgent(
    new ThoughtStep(input.modelFactory, input.eventBus, input.toolRegistry, input.sysPrompt),
    new ActionStep(input.gateway, input.toolRegistry, input.eventBus),
    new ObservationStep(input.modelFactory, input.eventBus, input.sysPrompt),
  );
}

function createReactSuccessResult(
  _pattern: AgentRunMode,
  _input: AgentRunInput,
  _runId: string,
  content: string,
  _toolCalls: number,
  _failedToolCalls: number,
): AgentRunResult {
  return {
    content,
    format: "text",
  };
}

function createReactFailureResult(
  _pattern: AgentRunMode,
  _input: AgentRunInput,
  _runId: string,
  error: unknown,
  _toolCalls: number,
  _failedToolCalls: number,
): AgentRunResult {
  return {
    format: "text",
    errorInfo: {
      code: "REACT_AGENT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function createReactMaxStepResult(
  _pattern: AgentRunMode,
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
      code: "REACT_AGENT_MAX_STEPS",
      message: "ReAct agent stopped after reaching the max step limit.",
    },
  };
}
