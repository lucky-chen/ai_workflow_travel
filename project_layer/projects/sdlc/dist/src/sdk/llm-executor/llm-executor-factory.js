// LLM executor factory: builds the default agent runtime used by the SDLC-facing llm executor facade.
import { ExecutionStrategySelector, createDefaultAgent, } from "ai-meta-agent-agent-runtime";
export function createLlmExecutorAgent(dependencies = {}, traceRecorder) {
    const selector = new ExecutionStrategySelector();
    const backend = selector.select(dependencies).executor;
    return createDefaultAgent({
        backend,
        traceRecorder,
    });
}
