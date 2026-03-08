import { createLlmExecutorAgent } from "./llm-executor-factory.js";
import { AgentTraceRecorderAdapter } from "./agent-trace-recorder-adapter.js";
// Public API: shared LLM execution entry used by generation and contract modules.
export class LlmExecutorService {
    agent;
    traceRecorder;
    constructor(dependencies = {}) {
        this.traceRecorder = dependencies.traceRecorder;
        const agentTraceRecorder = this.traceRecorder
            ? new AgentTraceRecorderAdapter(this.traceRecorder)
            : undefined;
        this.agent = createLlmExecutorAgent(dependencies, agentTraceRecorder);
    }
    async execute(request) {
        await this.traceRecorder?.recordTrace({
            taskId: "llm-executor",
            eventType: "llm_execution_started",
            summary: "LLM execution started.",
            metadata: {
                responseFormat: request.responseFormat,
            },
        });
        const result = await this.agent.run({
            request,
            inputPayload: {
                responseFormat: request.responseFormat,
                metadata: request.metadata ?? {},
            },
        });
        await this.traceRecorder?.recordTrace({
            taskId: "llm-executor",
            eventType: "llm_execution_finished",
            summary: "LLM execution finished.",
            metadata: {
                responseFormat: result.result.responseFormat,
            },
        });
        return result.result;
    }
}
