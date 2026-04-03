import type { ContextBudgetLimits, ContextView } from "./types.js";

export interface ContextBudgetPolicyContract {
  bound(originalContext: ContextView, runtimeLimits: ContextBudgetLimits): ContextView;
}

export class ContextBudgetPolicy implements ContextBudgetPolicyContract {
  bound(originalContext: ContextView, runtimeLimits: ContextBudgetLimits): ContextView {
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
