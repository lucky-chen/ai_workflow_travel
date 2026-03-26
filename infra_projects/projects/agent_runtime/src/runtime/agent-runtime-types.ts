export interface AgentSessionRequest {
  payload: AgentPromptPayload;
  metadata?: RequestMetadata;
}

export interface AgentSessionCreateInput {
  title?: string;
  initialSystemPrompt?: string[];
  initialUserPrompt?: Record<string, unknown>;
  metadata?: RequestMetadata;
}

export interface AgentSessionOpenInput {
  sessionId: string;
}

export interface AgentPromptPayload {
  prompt: {
    systemPrompt: string[];
    userPrompt: Record<string, unknown>;
  };
  responseFormat: "text" | "json";
  memoryScope?: string;
  retrievalQuery?: string;
  mcpToolCalls?: McpToolRequest[];
}

export interface RequestMetadata {
  requestId?: string;
  caller?: string;
  traceId?: string;
  labels?: Record<string, string>;
}

export interface AgentContext {
  request: {
    prompt: {
      systemPrompt: string[];
      userPrompt: Record<string, unknown>;
    };
    responseFormat: "text" | "json";
    metadata?: RequestMetadata;
  };
  runtimeContext: {
    sessionId: string;
    workdir: string;
    history: MessageTurn[];
    memory: MemoryEntry[];
    retrievalContext: RetrievalItem[];
    mcpToolCalls: McpToolRequest[];
  };
}

export interface AgentSessionState {
  sessionId: string;
  title?: string;
  createdAt: string;
  status: "active" | "completed" | "failed" | "closed";
  initialRequest?: AgentSessionRequest;
  transcript: MessageTurn[];
  metadata?: RequestMetadata;
}

export interface MessageTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface MemoryEntry {
  key: string;
  content: string;
}

export interface RetrievalItem {
  ref: string;
  content: string;
  metadata?: Record<string, string>;
}

export interface RetrievalRequest {
  query: string;
  candidateSources: string[];
  metadata?: RequestMetadata;
}

export interface ExecutionPlan {
  mode: "direct_generation" | "tool_augmented_generation";
  summary: string;
  stepIndex: number;
  nextStepGoal: string;
  completed?: boolean;
  stopReason?: "completed" | "max_steps" | "cancelled" | "failed";
  toolSteps?: McpToolRequest[];
}

export interface ExecutionResult {
  content: ModelBackendResult["content"];
  responseFormat: ModelBackendResult["responseFormat"];
  toolResults?: McpToolResult[];
  metadata?: ModelBackendResult["metadata"];
}

export interface ModelBackendRequest {
  mode: "planning" | "execution";
  prompt: {
    systemPrompt: string[];
    userPrompt: Record<string, unknown>;
  };
  responseFormat: "text" | "json";
  metadata?: RequestMetadata;
}

export interface ModelBackendResult {
  content: string;
  responseFormat: "text" | "json";
  metadata?: RequestMetadata;
}

export interface PlanningPromptBuilderInput {
  context: AgentContext;
  priorStepResults?: ExecutionResult[];
  priorObservation?: ObservationResult;
}

export interface ExecutionPromptBuilderInput {
  context: AgentContext;
  plan: ExecutionPlan;
  toolResults?: McpToolResult[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity?: "low" | "medium" | "high";
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  issues?: ValidationIssue[];
}

export interface McpToolRequest {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  toolName: string;
  success: boolean;
  content: string;
  metadata?: Record<string, string>;
}

export type ObservationIssue = ValidationIssue;

export interface ObservationResult {
  accepted: boolean;
  summary: string;
  completed?: boolean;
  issues?: ObservationIssue[];
  continueReason?: string;
}

export interface RuntimeMetrics {
  stepCount: number;
  modelLatencyMs?: number;
  toolLatencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentRuntimeResult {
  status: "success" | "failed";
  payload: {
    content?: string;
    responseFormat?: "text" | "json";
    history?: MessageTurn[];
    memory?: MemoryEntry[];
    retrievalContext?: RetrievalItem[];
    toolResults?: McpToolResult[];
    accepted?: boolean;
    completed?: boolean;
    summary?: string;
    stopReason?: "completed" | "max_steps" | "cancelled" | "failed";
    lastStepIndex?: number;
    metrics?: RuntimeMetrics;
  };
  diagnostics?: ValidationIssue[];
}

export type AgentTraceEventType =
  | "session_create_requested"
  | "session_created"
  | "session_open_requested"
  | "session_opened"
  | "session_closed"
  | "run_started"
  | "plan_generated"
  | "tool_called"
  | "tool_result_recorded"
  | "execution_finished"
  | "observation_finished"
  | "validation_failed"
  | "run_finished";

export type AgentTraceScope = "sdk" | "session";

export interface AgentTraceEventBase {
  traceId: string;
  stepIndex?: number;
  timestamp: string;
  caller: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface SdkTraceEvent extends AgentTraceEventBase {
  scope: "sdk";
  eventType:
    | "session_create_requested"
    | "session_created"
    | "session_open_requested"
    | "session_opened"
    | "session_closed";
  runId?: never;
  sessionId?: string;
  diagnostics?: never;
}

export interface SessionRunTraceEvent extends AgentTraceEventBase {
  scope: "session";
  eventType:
    | "run_started"
    | "plan_generated"
    | "tool_called"
    | "tool_result_recorded"
    | "execution_finished"
    | "observation_finished"
    | "validation_failed"
    | "run_finished";
  sessionId: string;
  runId: string;
  diagnostics?: ValidationIssue[];
}

export type AgentTraceEvent = SdkTraceEvent | SessionRunTraceEvent;

export interface AgentRuntimeDependencies {
  workdir: string;
  traceRecorder?: IAgentTraceRecorder;
}

export interface AgentRuntime {
  createSession(input: AgentSessionCreateInput): Promise<AgentSession>;
  openSession(input: AgentSessionOpenInput): Promise<AgentSession>;
  closeSession(sessionId: string): Promise<boolean>;
}

export interface AgentSession {
  execute(request: AgentSessionRequest): Promise<AgentRuntimeResult>;
  read(): Promise<AgentSessionState>;
}

export interface IAgentTraceRecorder {
  record(event: AgentTraceEvent): Promise<void>;
}

export interface IModelBackend {
  execute(request: ModelBackendRequest): Promise<ModelBackendResult>;
}

export interface IMcpGateway {
  call(request: McpToolRequest): Promise<McpToolResult>;
}

export interface IAgent {
  run(context: AgentContext): Promise<AgentRuntimeResult>;
}

export interface IPlanner {
  plan(context: AgentContext): Promise<ExecutionPlan>;
}

export interface IExecutor {
  execute(context: AgentContext, plan: ExecutionPlan): Promise<ExecutionResult>;
}

export interface IObserver {
  observe(
    context: AgentContext,
    plan: ExecutionPlan,
    result: ExecutionResult,
  ): Promise<ObservationResult>;
}

export interface CancellationController {
  isCancelled(runId: string): Promise<boolean>;
}

export interface CheckpointStore {
  save(runId: string, payload: Record<string, unknown>): Promise<void>;
}

export interface StreamingEventSink {
  emit(event: Record<string, unknown>): Promise<void>;
}

export interface RuntimeSafetyPolicy {
  check(input: Record<string, unknown>): Promise<void>;
}

export interface MultiAgentCoordinator {
  handoff(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}
