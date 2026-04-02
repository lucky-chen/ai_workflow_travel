import type { AgentRunMode, IAgent } from "../../interface/agent-api.js";
import type { AgentSelectionInput, IntentRouter } from "../types.js";

export interface IntentRoutingResult {
  mode: AgentRunMode;
  reasonCode: string;
}

export interface IntentRoutingRule {
  resolve(input: AgentSelectionInput): Promise<IntentRoutingResult | undefined>;
}

export interface IntentRoutingLlm {
  resolve(input: AgentSelectionInput): Promise<IntentRoutingResult>;
}

export interface IntentRouterFactoryInput {
  ruleRouter: IntentRoutingRule;
  llmRouter: IntentRoutingLlm;
}

export type IntentRouterContract = IntentRouter;
