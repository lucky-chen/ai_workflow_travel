import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { FetchLike } from "../model/types.js";
import { createRuntime as createRuntimeImpl } from "../runtime/runtime.js";

export type { FetchLike } from "../model/types.js";

export interface SessionEvent {
  timestamp: string;
  brief: string;
  sessionId?: string;
  traceId?: string;
  details?: Record<string, unknown>;
}

export interface SessionEventListener {
  onEvent(event: SessionEvent): Promise<void> | void;
}

export interface RuntimeCreateOptions {
  workdir: string;
  defaultModelMode?: "mock" | "real_from_local_env";
  realProviderFetchFn?: FetchLike;
  externalMcpEndpoints?: ExternalMcpEndpointConfig[];
}

export interface SessionApi {
  createSession(input: AgentSessionAccessInput): Promise<ISession>;
  openSession(sessionId: string): Promise<ISession>;
  closeSession(sessionId: string): Promise<CloseSessionResult>;
  subscribeEvents(listener: SessionEventListener): void;
  unsubscribeEvents(listener: SessionEventListener): void;
}

export interface ISession {
  load(): Promise<SessionData>;
  isRunning(): boolean;
  execute(userInput: UserInput): Promise<SessionResult>;
}

export interface UserInput {
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SessionData {
  sessionId: string;
  history: ChatHistoryItem[];
}

export interface ChatHistoryItem {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

export interface AgentSessionAccessInput {
  title?: string;
  sysPrompt?: string[];
  userPrompt?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface SessionResult {
  sessionId: string;
  traceId?: string;
  content?: string | Record<string, unknown>;
  format?: "text" | "json";
  errorCode?: string;
  errorMessage?: string;
}

export interface CloseSessionResult {
  sessionId: string;
}

export function createRuntime(options: RuntimeCreateOptions): SessionApi {
  return createRuntimeImpl(options);
}
