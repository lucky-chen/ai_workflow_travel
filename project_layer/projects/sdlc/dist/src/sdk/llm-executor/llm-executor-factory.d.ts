import { type IAgent, type IAgentTraceRecorder, type ModelExecutionDependencies, type ModelExecutionMode, type RealProviderConfig } from "ai-meta-agent-agent-runtime";
export type LlmExecutorMode = ModelExecutionMode;
export interface LlmExecutorServiceDependencies extends ModelExecutionDependencies {
    mode?: LlmExecutorMode;
    realProvider?: RealProviderConfig;
}
export declare function createLlmExecutorAgent(dependencies?: LlmExecutorServiceDependencies, traceRecorder?: IAgentTraceRecorder): IAgent;
