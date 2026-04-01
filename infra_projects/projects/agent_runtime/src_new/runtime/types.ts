import type { FetchLike, RealLlmProvider } from "../model/types.js";
import type {
  AgentSessionAccessInput,
  AgentRunMode,
  ChatHistoryItem,
  SessionData,
  SessionResult,
  UserInput,
} from "../interface/api.js";
import type { ContextBudgetLimits } from "../context/types.js";
import type { ContextAssembler } from "../context/context-assembler.js";
import type { SessionTranscript } from "../context/session-transcript.js";
import type { RuntimeMemory } from "../context/runtime-memory.js";
import type { AgentFactory, AgentRuntimeResult, IntentRouter } from "../orchestration/types.js";
import type { Metrics } from "../observability/metrics.js";
import type { Trace } from "../observability/trace.js";
import type { RunCheckpoint } from "./run-checkpoint.js";
import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";

export interface RuntimeDependencies {
  storageRoot: string;
}

export interface RuntimeModelConfig {
  mock: boolean;
  modeSelection?: {
    provider?: RealLlmProvider;
    url?: string;
    key?: string;
    model?: string;
    timeoutMs?: number;
  };
  mockInfo?: Record<string, unknown>;
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
  model?: RuntimeModelConfig;
  runtimeLimits?: ContextBudgetLimits;
  allowedWorkingDirectories?: string[];
}

export interface StoredSessionState {
  sessionId: string;
  title?: string;
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

export interface RuntimeServices {
  storageRoot: string;
  contextAssembler: ContextAssembler;
  sessionTranscript: SessionTranscript;
  runtimeMemory: RuntimeMemory;
  intentRouter: IntentRouter;
  agentFactory: AgentFactory;
  metrics: Metrics;
  trace: Trace;
  eventBus: RuntimeEventBus;
  checkpoint: RunCheckpoint;
  resolveDefaultModelConfig(): Promise<RuntimeModelConfig>;
}

export interface AgentSessionExecutionContext {
  requestedMode: AgentRunMode;
  result: AgentRuntimeResult;
  sessionConfig?: RuntimeSessionConfig;
}
