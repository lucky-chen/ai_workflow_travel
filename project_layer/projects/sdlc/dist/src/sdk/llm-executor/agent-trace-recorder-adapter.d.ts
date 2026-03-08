import type { IAgentTraceRecorder, AgentTraceEvent } from "ai-meta-agent-agent-runtime";
import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
export declare class AgentTraceRecorderAdapter implements IAgentTraceRecorder {
    private readonly traceRecorder;
    constructor(traceRecorder: ITraceRecorder);
    record(event: AgentTraceEvent): Promise<string>;
}
