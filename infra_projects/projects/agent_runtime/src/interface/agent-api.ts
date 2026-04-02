import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { FetchLike } from "../model/types.js";
import { createAgent as createAgentImpl } from "../orchestration/agent.js";

export type { FetchLike } from "../model/types.js";

export type AgentRunMode = "chat" | "react" | "peo";

export interface AgentCreateOptions {
  workdir: string;
  mode?: AgentRunMode;
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
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
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

export function createAgent(options: AgentCreateOptions): IAgent {
  return createAgentImpl(options);
}
