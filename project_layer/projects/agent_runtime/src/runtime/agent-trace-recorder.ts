export interface AgentTraceEvent {
  runId: string;
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface IAgentTraceRecorder {
  record(event: AgentTraceEvent): Promise<string>;
}
