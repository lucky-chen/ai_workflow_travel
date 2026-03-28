import type { UserInput } from "../interface/api.js";
import {
  DefaultContextBudgetPolicy,
  type ContextBudgetPolicy,
} from "./context-budget-policy.js";
import type { RetrievalProvider } from "./retrieval-provider.js";
import type { RuntimeMemory } from "./runtime-memory.js";
import type { SessionTranscript } from "./session-transcript.js";
import type {
  AgentContext,
  ContextAssemblyInput,
  ContextView,
} from "./types.js";

export class ContextAssembler {
  constructor(
    private readonly sessionTranscript: SessionTranscript,
    private readonly runtimeMemory: RuntimeMemory,
    private readonly retrievalProvider: RetrievalProvider,
    private readonly contextBudgetPolicy: ContextBudgetPolicy = new DefaultContextBudgetPolicy(),
  ) {}

  async assemble(input: ContextAssemblyInput): Promise<AgentContext> {
    const transcriptContext = await this.sessionTranscript.load(input.sessionId);
    const runtimeMemoryContext = await this.runtimeMemory.load(input.sessionId);
    const retrievalContext = await this.loadRetrievalContext(input.userInput, input.sessionId);

    const originalContext: ContextView = {
      transcriptContext,
      runtimeMemoryContext,
      retrievalContext,
    };

    if (!input.runtimeLimits) {
      return { originalContext };
    }

    const boundedContext = await this.contextBudgetPolicy.bound(originalContext, input.runtimeLimits);
    return {
      originalContext,
      boundedContext,
    };
  }

  private async loadRetrievalContext(userInput: UserInput, sessionId: string) {
    const queryText = typeof userInput.content.queryText === "string"
      ? userInput.content.queryText
      : typeof userInput.content.task === "string"
        ? userInput.content.task
        : "";

    if (!queryText) {
      return undefined;
    }

    const result = await this.retrievalProvider.retrieve(userInput, sessionId, queryText);
    return result.fragments.length > 0 ? result : undefined;
  }
}

