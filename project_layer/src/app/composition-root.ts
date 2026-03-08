import { ArtifactStoreService } from "../data/artifact-store/artifact-store.js";
import { HistoryStoreService } from "../data/history-store/history-store.js";
import { InMemoryChangeGate } from "../quality-gate/change-gate/change-gate.js";
import { TraceService } from "../quality-gate/trace/trace-recorder.js";
import { LlmExecutorService, type LlmExecutorServiceDependencies } from "../sdk/llm-executor/llm-executor.js";

export interface ApplicationServices {
  artifactStore: ArtifactStoreService;
  historyStore: HistoryStoreService;
  traceRecorder: TraceService;
  changeGate: InMemoryChangeGate;
  llmExecutor: LlmExecutorService;
}

export interface CompositionRootOptions {
  artifactStorageRoot?: string;
  historyStorageRoot?: string;
  llmExecutor?: LlmExecutorServiceDependencies;
}

export function createApplicationServices(options: CompositionRootOptions = {}): ApplicationServices {
  const artifactStore = new ArtifactStoreService(options.artifactStorageRoot);
  const historyStore = new HistoryStoreService(options.historyStorageRoot);
  const traceRecorder = new TraceService(historyStore);
  const changeGate = new InMemoryChangeGate();
  const llmExecutor = new LlmExecutorService(options.llmExecutor);

  return {
    artifactStore,
    historyStore,
    traceRecorder,
    changeGate,
    llmExecutor,
  };
}
