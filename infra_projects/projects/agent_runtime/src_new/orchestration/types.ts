import type { AgentRunMode, UserInput } from "../interface/api.js";
import type { AgentContext, MemorySummaryItem, TranscriptTurn } from "../context/types.js";

export interface AgentSelector {
  select(input: AgentSelectionInput): Promise<IAgent>;
}

export interface IAgent {
  readonly pattern: "chat" | "react" | "peo";
  isRunning(): boolean;
  run(context: AgentRunContext): Promise<AgentRuntimeResult>;
}

export interface AgentRuntimeResult {
  runId: string;
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
  requestedMode: AgentRunMode;
}

export interface AgentSessionState {
  sessionId: string;
  transcriptTurnCount: number;
  hasToolHistory: boolean;
}

export interface AgentRunContext {
  context: AgentContext;
  sessionId: string;
  userInput: UserInput;
  requestedMode: AgentRunMode;
  sessionState: AgentSessionState;
  modelConfig?: {
    mock: boolean;
    modeSelection: {
      url?: string;
      key?: string;
      model?: string;
    };
    mockInfo?: Record<string, unknown>;
  };
  allowedWorkingDirectories?: string[];
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
