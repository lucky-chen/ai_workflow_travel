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

export interface IModelExecutionBackend {
  execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}

export interface CreateDefaultAgentOptions {
  backend: IModelExecutionBackend;
  traceRecorder?: import("./agent-trace-recorder.js").IAgentTraceRecorder;
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

export class DefaultExecutor implements IExecutor {
  constructor(private readonly backend: IModelExecutionBackend) {}

  async execute(context: AgentContext, _plan: ExecutionPlan): Promise<ExecutionResult> {
    const result = await this.backend.execute(context.request);
    return { result };
  }
}

export class DefaultAgent implements IAgent {
  constructor(
    private readonly planner: IPlanner,
    private readonly executor: IExecutor,
    private readonly observer: IObserver,
    private readonly traceRecorder?: import("./agent-trace-recorder.js").IAgentTraceRecorder,
  ) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const runId = getRunId(context);
    const plan = await this.planner.plan(context);
    await this.traceRecorder?.record({
      runId,
      eventType: "agent_plan_created",
      summary: "Agent plan created.",
      payload: {
        mode: plan.mode,
      },
    });

    await this.traceRecorder?.record({
      runId,
      eventType: "agent_execution_started",
      summary: "Agent execution started.",
      payload: {
        mode: plan.mode,
      },
    });
    const executionResult = await this.executor.execute(context, plan);
    await this.traceRecorder?.record({
      runId,
      eventType: "agent_execution_finished",
      summary: "Agent execution finished.",
      payload: {
        responseFormat: executionResult.result.responseFormat,
      },
    });

    const observation = await this.observer.observe(context, plan, executionResult);
    await this.traceRecorder?.record({
      runId,
      eventType: "agent_observation_finished",
      summary: "Agent observation finished.",
      payload: {
        accepted: observation.accepted,
      },
    });

    return {
      result: executionResult.result,
      plan,
      observation,
    };
  }
}

function getRunId(context: AgentContext): string {
  const requestId = context.request.metadata?.requestId;
  return requestId && requestId.trim().length > 0 ? requestId : "agent-run";
}

export function createDefaultAgent(options: CreateDefaultAgentOptions): IAgent {
  const planner = new DefaultPlanner();
  const executor = new DefaultExecutor(options.backend);
  const observer = new DefaultObserver();
  return new DefaultAgent(planner, executor, observer, options.traceRecorder);
}
