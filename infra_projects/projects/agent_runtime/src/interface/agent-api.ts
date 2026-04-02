import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { FetchLike } from "../model/types.js";

export type { FetchLike } from "../model/types.js";

export type AgentType = "chat" | "react" | "peo";

export interface AgentCreateOptions {
  workdir: string;
  type?: AgentType;
  sysPrompt?: string[];
  defaultModelMode?: "mock" | "real_from_local_env";
  realProviderFetchFn?: FetchLike;
  externalMcpEndpoints?: ExternalMcpEndpointConfig[];
}

export interface AgentRunInput {
  userInput: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface AgentRunResult {
  content?: string | Record<string, unknown>;
  format?: "text" | "json";
  errorInfo?: {
    code: string;
    message: string;
  };
  metrics?: {
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    toolUsage?: {
      toolCalls: number;
      failedToolCalls: number;
    };
  };
  custom?: Record<string, unknown>;
}

export interface AgentEvent {
  timestamp: string;
  brief: string;
  details?: Record<string, unknown>;
}

export interface AgentEventListener {
  onEvent(event: AgentEvent): Promise<void> | void;
}

export interface IAgent {
  run(input: AgentRunInput): Promise<AgentRunResult>;
  subscribeEvents(listener: AgentEventListener): void;
  unsubscribeEvents(listener: AgentEventListener): void;
}
