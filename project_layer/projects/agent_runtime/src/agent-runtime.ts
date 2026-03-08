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

export interface ExecutionPlan {
  mode: "direct_generation";
  summary: string;
}

export interface ExecutionResult {
  result: LlmExecutionResult;
}

export interface ObservationResult {
  accepted: boolean;
  summary: string;
}

export interface AgentResult {
  result: LlmExecutionResult;
  plan: ExecutionPlan;
  observation: ObservationResult;
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

export class DefaultPlanner implements IPlanner {
  async plan(_context: AgentContext): Promise<ExecutionPlan> {
    return {
      mode: "direct_generation",
      summary: "Use direct generation for the current request.",
    };
  }
}

export class DefaultObserver implements IObserver {
  async observe(
    _context: AgentContext,
    _plan: ExecutionPlan,
    _result: ExecutionResult,
  ): Promise<ObservationResult> {
    return {
      accepted: true,
      summary: "Result accepted.",
    };
  }
}
