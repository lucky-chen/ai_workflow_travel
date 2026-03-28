import type { AgentRunMode } from "../interface/api.js";
import type { AgentSelectionInput, AgentSelector, IAgent } from "./types.js";

export interface AgentSelectorOptions {
  chatAgent: IAgent;
  reactAgent: IAgent;
  peoAgent: IAgent;
}

export class DefaultAgentSelector implements AgentSelector {
  constructor(private readonly options: AgentSelectorOptions) {}

  async select(input: AgentSelectionInput): Promise<IAgent> {
    const mode = input.requestedMode;
    if (mode === "chat") {
      return this.options.chatAgent;
    }
    if (mode === "react") {
      return this.options.reactAgent;
    }
    if (mode === "peo") {
      return this.options.peoAgent;
    }
    if (mode === "dynamic") {
      return this.selectDynamic(input);
    }
    return assertNever(mode);
  }

  private selectDynamic(input: AgentSelectionInput): IAgent {
    if (shouldUseReact(input)) {
      return this.options.reactAgent;
    }
    return this.options.chatAgent;
  }
}

function shouldUseReact(input: AgentSelectionInput): boolean {
  return input.sessionState.hasToolHistory
    || typeof input.userInput.content.toolName === "string"
    || input.userInput.metadata?.useTools === true;
}

function assertNever(mode: never): IAgent {
  throw new Error(`Unsupported requested mode: ${String(mode)}`);
}
