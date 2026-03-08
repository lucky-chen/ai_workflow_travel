export interface LlmTraceEvent {
  eventType: "execution_started" | "execution_finished";
  summary: string;
  metadata?: Record<string, string>;
}

export interface ILlmTraceRecorder {
  record(event: LlmTraceEvent): Promise<string>;
}

export class InMemoryLlmTraceRecorder implements ILlmTraceRecorder {
  private readonly events: Array<{ ref: string; event: LlmTraceEvent }> = [];

  async record(event: LlmTraceEvent): Promise<string> {
    const ref = `llm-trace-${this.events.length + 1}`;
    this.events.push({ ref, event });
    return ref;
  }

  getEvents(): Array<{ ref: string; event: LlmTraceEvent }> {
    return [...this.events];
  }
}
