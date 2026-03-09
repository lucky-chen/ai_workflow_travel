export interface PromptInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmExecutionRequest {
  prompt: PromptInput;
  responseFormat: "text" | "json";
  metadata?: Record<string, string>;
}

export interface LlmExecutionResult {
  content: string;
  responseFormat: "text" | "json";
  metadata?: Record<string, string>;
}

export interface AgentContext {
  request: LlmExecutionRequest;
  inputPayload: Record<string, unknown>;
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

export interface ExecutionPlan {
  mode: "direct_generation" | "tool_augmented_generation";
  summary: string;
  toolSteps?: McpToolRequest[];
}

export interface ExecutionResult {
  result: LlmExecutionResult;
  toolResults?: McpToolResult[];
}

export interface ObservationResult {
  accepted: boolean;
  summary: string;
}

export interface AgentResult {
  result: LlmExecutionResult;
  plan: ExecutionPlan;
  observation: ObservationResult;
  toolResults?: McpToolResult[];
}

export interface IAgent {
  run(context: AgentContext): Promise<AgentResult>;
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

export interface IModelExecutionBackend {
  execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}

export interface IMcpGateway {
  call(request: McpToolRequest): Promise<McpToolResult>;
}
