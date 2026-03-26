export interface AgentTraceEvent {
  runId: string;
  caller: string;
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface IAgentTraceRecorder {
  record(event: AgentTraceEvent): Promise<string>;
}
