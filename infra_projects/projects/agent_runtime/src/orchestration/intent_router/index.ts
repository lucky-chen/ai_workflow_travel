import type { ModelFactory } from "../../model/model-factory.js";
import type { IntentRouter } from "../types.js";
import { IntentRouterStrategy } from "./intent_router_strategy.js";
import { LlmIntentRouter } from "./llm_intent_router.js";
import { RuleIntentRouter } from "./rule_intent_router.js";

export interface CreateIntentRouterInput {
  modelFactory: ModelFactory;
}

export function createIntentRouter(input: CreateIntentRouterInput): IntentRouter {
  return new IntentRouterStrategy({
    ruleRouter: new RuleIntentRouter(),
    llmRouter: new LlmIntentRouter({
      modelFactory: input.modelFactory,
    }),
  });
}
