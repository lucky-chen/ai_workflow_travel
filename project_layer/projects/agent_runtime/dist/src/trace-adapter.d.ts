import type { ITraceRecorder } from "../../sdlc/src/shared/contracts/pipeline.js";
import type { AgentTraceEvent, IAgentTraceRecorder } from "./agent-trace-recorder.js";
export declare class PipelineTraceAgentRecorderAdapter implements IAgentTraceRecorder {
    private readonly traceRecorder;
    constructor(traceRecorder: ITraceRecorder);
    record(event: AgentTraceEvent): Promise<string>;
}
