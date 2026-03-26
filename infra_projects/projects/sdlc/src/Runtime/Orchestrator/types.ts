import type { RuntimeContext, RuntimeInput, RuntimeResult, UnitRuntimeRequest } from "../Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { IChangeGate } from "../../SDK/QualityControl/Gate/change-gate.js";
import type { TraceService } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

export interface Orchestrator {
  run(input: RuntimeInput): Promise<RuntimeResult>;
}

export interface RuntimeOrchestratorDependencies {
  artifactStore: IArtifactStore;
  llmExecutor: ILlmExecutor;
  resourceRoot?: string;
  traceRecorder: ITraceRecorder;
  traceService?: TraceService;
  changeGate?: IChangeGate;
}

export interface RuntimeUnit {
  run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult>;
}
