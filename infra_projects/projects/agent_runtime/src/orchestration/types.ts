import type { ModelConfig } from "../model/types.js";
import type { IAgent, AgentRunMode, AgentRunResult } from "../interface/agent-api.js";
import type { UserInput } from "../interface/api.js";

export interface AgentFactory {
  create(mode: AgentRunMode, options?: { modelConfig?: ModelConfig }): Promise<IAgent>;
}

export interface IntentRouter {
  resolve(input: AgentSelectionInput): Promise<{
    mode: AgentRunMode;
    reasonCode: string;
  }>;
}

export interface AgentSelectionInput {
  userInput: UserInput;
}

export interface DelegationInput {
  task: Record<string, unknown>;
}

export interface DelegationResult {
  result: Record<string, unknown>;
}

export interface MultiAgentProtocol {
  delegate(input: DelegationInput): Promise<DelegationResult>;
}
