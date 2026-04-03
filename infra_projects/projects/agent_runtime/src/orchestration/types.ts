import type { ModelConfig } from "../model/types.js";
import type { IAgent, AgentType } from "../interface/agent-api.js";
import type { UserInput } from "../interface/api.js";
import type { Trace } from "../observability/trace.js";

export interface AgentFactory {
  create(type: AgentType, options?: { modelConfig?: ModelConfig; sysPrompt?: string[]; trace?: Trace }): IAgent;
}

export interface IntentRouter {
  resolve(input: AgentSelectionInput): Promise<{
    type: AgentType;
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
