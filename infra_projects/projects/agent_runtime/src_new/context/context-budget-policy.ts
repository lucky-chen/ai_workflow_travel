import type { ContextBudgetLimits, ContextView } from "./types.js";

export interface ContextBudgetPolicy {
  bound(originalContext: ContextView, runtimeLimits: ContextBudgetLimits): Promise<ContextView>;
}

export class DefaultContextBudgetPolicy implements ContextBudgetPolicy {
  async bound(originalContext: ContextView, runtimeLimits: ContextBudgetLimits): Promise<ContextView> {
    return {
      transcriptContext: {
        turns: originalContext.transcriptContext.turns.slice(-runtimeLimits.maxTranscriptTurns),
      },
      runtimeMemoryContext: {
        summaryItems: originalContext.runtimeMemoryContext.summaryItems.slice(-runtimeLimits.maxMemoryItems),
      },
      retrievalContext: originalContext.retrievalContext
        ? {
            fragments: originalContext.retrievalContext.fragments.slice(0, runtimeLimits.maxRetrievalFragments),
          }
        : undefined,
    };
  }
}

