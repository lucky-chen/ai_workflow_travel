import { ArtifactStoreService } from "../data/artifact-store/artifact-store.js";
import { HistoryStoreService } from "../data/history-store/history-store.js";
import { InMemoryChangeGate } from "../quality-gate/change-gate/change-gate.js";
import { TraceService } from "../quality-gate/trace/trace-recorder.js";
import { LlmExecutorService } from "../sdk/llm-executor/llm-executor.js";
export function createApplicationServices(options = {}) {
    const artifactStore = new ArtifactStoreService(options.artifactStorageRoot);
    const historyStore = new HistoryStoreService(options.historyStorageRoot);
    const traceRecorder = new TraceService(historyStore);
    const changeGate = new InMemoryChangeGate();
    const llmExecutor = new LlmExecutorService({
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
