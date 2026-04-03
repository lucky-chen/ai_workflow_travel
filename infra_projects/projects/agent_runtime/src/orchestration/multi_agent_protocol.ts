import type { DelegationInput, DelegationResult, MultiAgentProtocol as MultiAgentProtocolContract } from "./types.js";

export class MultiAgentProtocol implements MultiAgentProtocolContract {
  delegate(input: DelegationInput): Promise<DelegationResult> {
    return Promise.resolve({
      result: {
        enabled: false,
        reason: "MULTI_AGENT_NOT_ENABLED",
        task: input.task,
      },
    });
  }
}
