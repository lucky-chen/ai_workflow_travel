import type { AgentSelectionInput } from "../types.js";
import type { IntentRouterContract, IntentRouterFactoryInput, IntentRoutingResult } from "./shared.js";

export class IntentRouterStrategy implements IntentRouterContract {
  constructor(private readonly input: IntentRouterFactoryInput) {}

  async resolve(input: AgentSelectionInput): Promise<IntentRoutingResult> {
    const ruleResult = await this.input.ruleRouter.resolve(input);
    if (ruleResult) {
      return ruleResult;
    }
    return this.input.llmRouter.resolve(input);
  }
}
