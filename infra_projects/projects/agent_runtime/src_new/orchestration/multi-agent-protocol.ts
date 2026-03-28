import type { DelegationInput, DelegationResult, MultiAgentProtocol } from "./types.js";

export class ReservedMultiAgentProtocol implements MultiAgentProtocol {
  async delegate(input: DelegationInput): Promise<DelegationResult> {
    return {
      result: {
        enabled: false,
        reason: "MULTI_AGENT_NOT_ENABLED",
        task: input.task,
      },
    };
  }
}
