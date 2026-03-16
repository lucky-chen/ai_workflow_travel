import { ArtifactStoreService } from "../Data/artifact-store.js";
import { HistoryStoreService } from "../Data/history-store.js";
import { InMemoryChangeGate } from "../SDK/QualityControl/Gate/change-gate.js";
import { TraceService } from "../SDK/QualityControl/Trace/trace-recorder.js";
import {
  LlmExecutorService,
  type ILlmExecutor,
  type LlmExecutorServiceDependencies,
} from "../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { RuntimeInput, RuntimeResult } from "./Schema/runtime.js";
import { RuntimeOrchestrator, type Orchestrator } from "./orchestrator.js";

export interface ApplicationInfrastructure {
  artifactStore: ArtifactStoreService;
  historyStore: HistoryStoreService;
  traceRecorder: TraceService;
  changeGate: InMemoryChangeGate;
  llmExecutor: ILlmExecutor;
}

export interface ApplicationOptions {
  artifactStorageRoot?: string;
  historyStorageRoot?: string;
  llmExecutor?: LlmExecutorServiceDependencies;
  llmExecutorInstance?: ILlmExecutor;
  changeGate?: InMemoryChangeGate;
}

export interface Application {
  run(input: RuntimeInput): Promise<RuntimeResult>;
}

export function createApplicationInfrastructure(options: ApplicationOptions = {}): ApplicationInfrastructure {
  const historyStore = new HistoryStoreService(options.historyStorageRoot);
  const traceRecorder = new TraceService(historyStore);
  const artifactStore = new ArtifactStoreService(options.artifactStorageRoot, traceRecorder);
  const changeGate = options.changeGate ?? new InMemoryChangeGate();

  const llmExecutor = options.llmExecutorInstance ?? new LlmExecutorService({
    ...options.llmExecutor,
    traceRecorder,
  });

  return {
    artifactStore,
    historyStore,
    traceRecorder,
    changeGate,
    llmExecutor,
  };
}

export function createApplication(options: ApplicationOptions = {}): Application {
  const infrastructure = createApplicationInfrastructure(options);
  const orchestrator: Orchestrator = new RuntimeOrchestrator();

  return {
    async run(input: RuntimeInput): Promise<RuntimeResult> {
      return orchestrator.run(input);
    },
  };
}
