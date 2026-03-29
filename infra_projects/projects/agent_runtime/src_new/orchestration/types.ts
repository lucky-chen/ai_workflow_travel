import type { AgentRunMode, UserInput } from "../interface/api.js";
import type { AgentContext, MemorySummaryItem, TranscriptTurn } from "../context/types.js";

export interface AgentFactory {
  create(mode: AgentRunMode): Promise<IAgent>;
}

export interface IntentRouter {
  resolve(input: AgentSelectionInput): Promise<{
    mode: IAgent["pattern"];
    reasonCode: string;
  }>;
}

export interface IAgent {
  readonly pattern: "chat" | "react" | "peo";
  isRunning(): boolean;
  run(context: AgentContext): Promise<AgentRuntimeResult>;
}

export interface AgentRuntimeResult {
  traceId?: string;
  content?: {
    data: string | Record<string, unknown>;
    format: "text" | "json";
  };
  errorInfo?: {
    code: string;
    message: string;
  };
  agent: {
    prompt: {
      system: string[];
      user: Record<string, unknown>;
    };
    pattern: "chat" | "react" | "peo";
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  };
  stateUpdate: {
    transcriptAppend: TranscriptTurn[];
    runtimeMemorySummaryItems: MemorySummaryItem[];
  };
  executionFacts?: {
    toolCalls: number;
    failedToolCalls: number;
  };
}

export interface AgentSelectionInput {
  userInput: UserInput;
  sessionState: AgentSessionState;
}

export interface AgentSessionState {
  sessionId: string;
  transcriptTurnCount: number;
  hasToolHistory: boolean;
}

export interface DelegationInput {
  task: Record<string, unknown>;
}

export interface DelegationResult {
  result: Record<string, unknown>;
}

export interface MultiAgentProtocol {
  delegate(input: DelegationInput): Promise<DelegationResult>;
}
