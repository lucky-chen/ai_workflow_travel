import type { UserInput } from "../interface/api.js";
import type { AgentRunInput } from "../interface/agent-api.js";

export interface ContextAssemblyInput {
  sessionId: string;
  userInput: UserInput;
  runtimeLimits?: ContextBudgetLimits;
}

export interface ContextBudgetLimits {
  maxTranscriptTurns: number;
  maxMemoryItems: number;
  maxRetrievalFragments: number;
}

export interface AssembledContext {
  originalContext: ContextView;
  boundedContext?: ContextView;
}

export type AgentContext = AgentRunInput;

export interface ContextView {
  transcriptContext: TranscriptContext;
  runtimeMemoryContext: MemoryContext;
  retrievalContext?: RetrievalContext;
}

export interface TranscriptTurn {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: string;
}

export interface TranscriptContext {
  turns: TranscriptTurn[];
}

export interface MemorySummaryItem {
  summary: string;
  sourceTurnId?: string;
}

export interface MemoryContext {
  summaryItems: MemorySummaryItem[];
}

export interface RetrievalFragment {
  content: string;
  source?: string;
  score?: number;
}

export interface RetrievalContext {
  fragments: RetrievalFragment[];
}
