import type { AgentSelectionInput, IAgent, IntentRouter } from "../types.js";

export interface IntentRoutingResult {
  mode: IAgent["pattern"];
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
