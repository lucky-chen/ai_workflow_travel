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
    observe(context: AgentContext, plan: ExecutionPlan, result: ExecutionResult): Promise<ObservationResult>;
}
export interface IModelExecutionBackend {
    execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}
export interface CreateDefaultAgentOptions {
    backend: IModelExecutionBackend;
    traceRecorder?: import("./agent-trace-recorder.js").IAgentTraceRecorder;
}
export declare class DefaultPlanner implements IPlanner {
    plan(_context: AgentContext): Promise<ExecutionPlan>;
}
export declare class DefaultObserver implements IObserver {
    observe(_context: AgentContext, _plan: ExecutionPlan, _result: ExecutionResult): Promise<ObservationResult>;
}
export declare class DefaultExecutor implements IExecutor {
    private readonly backend;
    constructor(backend: IModelExecutionBackend);
    execute(context: AgentContext, _plan: ExecutionPlan): Promise<ExecutionResult>;
}
export declare class DefaultAgent implements IAgent {
    private readonly planner;
    private readonly executor;
    private readonly observer;
    private readonly traceRecorder?;
    constructor(planner: IPlanner, executor: IExecutor, observer: IObserver, traceRecorder?: import("./agent-trace-recorder.js").IAgentTraceRecorder | undefined);
    run(context: AgentContext): Promise<AgentResult>;
}
export declare function createDefaultAgent(options: CreateDefaultAgentOptions): IAgent;
