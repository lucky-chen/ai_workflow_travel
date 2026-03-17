import type { RuntimeInput, RuntimeResult } from "./Schema/runtime.js";
import { RuntimeOrchestrator, type Orchestrator } from "./Orchestrator/index.js";
import { configureResourceResolver, type ResourceResolverConfig } from "./resource-resolver.js";
import { ArtifactStoreService } from "../Data/artifact-store.js";
import { HistoryStoreService } from "../Data/history-store.js";
import { InMemoryChangeGate } from "../SDK/QualityControl/Gate/change-gate.js";
import { TraceService } from "../SDK/QualityControl/Trace/trace-recorder.js";
import {
  LlmExecutorService,
  type ILlmExecutor,
  type LlmExecutorServiceDependencies,
} from "../SDK/AgentRuntime/LlmExecutor/llm-executor.js";

export interface ApplicationConfig {
  artifactStorageRoot?: string;
  historyStorageRoot?: string;
  resourceResolver?: Partial<ResourceResolverConfig>;
  llmExecutor?: LlmExecutorServiceDependencies;
  llmExecutorInstance?: ILlmExecutor;
  changeGate?: InMemoryChangeGate;
}

export interface Application {
  run(input: RuntimeInput): Promise<RuntimeResult>;
}

export class ApplicationService implements Application {
  constructor(private readonly orchestrator: Orchestrator) {}

  async run(input: RuntimeInput): Promise<RuntimeResult> {
    return this.orchestrator.run(input);
  }
}

export function createApplication(config: ApplicationConfig = {}): Application {
  configureResourceResolver(config.resourceResolver ?? {});
  const historyStore = new HistoryStoreService(config.historyStorageRoot);
  const traceRecorder = new TraceService(historyStore);
  const artifactStore = new ArtifactStoreService(config.artifactStorageRoot, traceRecorder);
  const changeGate = config.changeGate ?? new InMemoryChangeGate();
  const llmExecutor = config.llmExecutorInstance ?? new LlmExecutorService({
    ...config.llmExecutor,
    traceRecorder,
  });
  return new ApplicationService(new RuntimeOrchestrator({
    artifactStore,
    llmExecutor,
    traceRecorder,
    traceService: traceRecorder,
    changeGate,
  }));
}
