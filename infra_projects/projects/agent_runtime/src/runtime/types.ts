import type { FetchLike, ModelConfig, RealLlmProvider } from "../model/types.js";
import type { Storage } from "../data/storage.js";
import type {
  AgentSessionAccessInput,
  ChatHistoryItem,
  SessionEvent,
  SessionData,
  SessionResult,
  UserInput,
} from "../interface/api.js";
import type { ContextBudgetLimits } from "../context/types.js";
import type { ContextAssembler } from "../context/context-assembler.js";
import type { SessionTranscript } from "../context/session-transcript.js";
import type { RuntimeMemory } from "../context/runtime-memory.js";
import type { AgentFactory, IntentRouter } from "../orchestration/types.js";
import type { Metrics } from "../observability/metrics.js";
import type { RunCheckpoint } from "./run-checkpoint.js";
import type { ModelFactory } from "../model/model-factory.js";

export interface RuntimeDependencies {
  storageRoot: string;
}

export interface RealProviderConfig {
  provider: RealLlmProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  fetchFn?: FetchLike;
}

export interface RuntimeSessionConfig extends Record<string, unknown> {
  model?: ModelConfig;
  runtimeLimits?: ContextBudgetLimits;
  allowedWorkingDirectories?: string[];
}

export interface StoredSessionState {
  sessionId: string;
  title?: string;
  systemPrompt?: string[];
  history: ChatHistoryItem[];
  config?: RuntimeSessionConfig;
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeSessionCreateInput extends AgentSessionAccessInput {
  sessionId: string;
}

export interface AgentSessionLike {
  sessionId: string;
  load(): Promise<SessionData>;
  isRunning(): boolean;
  execute(userInput: UserInput): Promise<SessionResult>;
  close(): Promise<void>;
}

export interface AgentRuntimeComponents {
  storageRoot: string;
  storage: Storage;
  modelFactory: ModelFactory;
  agentFactory: AgentFactory;
  metrics: Metrics;
  checkpoint: RunCheckpoint;
}

export interface SessionRuntimeComponents {
  intentRouter: IntentRouter;
  contextAssembler: ContextAssembler;
  sessionTranscript: SessionTranscript;
  runtimeMemory: RuntimeMemory;
}

export interface SessionEventSink {
  emit(event: SessionEvent): Promise<void>;
}
