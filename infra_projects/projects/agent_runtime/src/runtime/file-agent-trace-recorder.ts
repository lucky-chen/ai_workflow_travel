import type {
  AgentTraceEvent,
  IAgentTraceRecorder,
  TokenUsageSummary,
} from "./agent-runtime-types.js";
import { createEmptyTokenUsageSummary } from "./agent-runtime-types.js";
import { BufferedFileStore } from "../shared/buffered-file-store.js";

const TRACE_BUFFER_KEY = "runtime-trace";

export class FileAgentTraceRecorder extends BufferedFileStore<AgentTraceEvent[]> implements IAgentTraceRecorder {
  constructor(
    private readonly outputPath: string,
    flushThreshold = 3,
  ) {
    super(flushThreshold);
  }

  async record(event: AgentTraceEvent): Promise<void> {
    const events = await this.loadBuffered(TRACE_BUFFER_KEY);
    events.push(event);
    await this.saveBuffered(TRACE_BUFFER_KEY, events);

    if (this.shouldFlush(event)) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    await this.flushBuffered(TRACE_BUFFER_KEY);
  }

  private shouldFlush(event: AgentTraceEvent): boolean {
    return (
      this.shouldFlushByThreshold()
      || event.eventType === "run_finished"
      || event.eventType === "session_closed"
    );
  }

  summarizeSessionUsage(sessionId: string): TokenUsageSummary {
    return this.loadCurrentEvents()
      .filter((event) => event.scope === "session" && event.sessionId === sessionId)
      .reduce<TokenUsageSummary>((summary, event) => {
        const usage = event.payload?.usage;
        if (!usage || typeof usage !== "object") {
          return summary;
        }

        const usageRecord = usage as Record<string, unknown>;
        const inputTokens = asNumber(usageRecord.prompt_tokens) + asNumber(usageRecord.input_tokens);
        const outputTokens = asNumber(usageRecord.completion_tokens) + asNumber(usageRecord.output_tokens);
        const totalTokens = asNumber(usageRecord.total_tokens) || inputTokens + outputTokens;

        return {
          inputTokens: summary.inputTokens + inputTokens,
          outputTokens: summary.outputTokens + outputTokens,
          totalTokens: summary.totalTokens + totalTokens,
        };
      }, createEmptyTokenUsageSummary());
  }

  protected resolvePath(): string {
    return this.outputPath;
  }

  protected emptyValue(): AgentTraceEvent[] {
    return [];
  }

  protected parse(raw: string): AgentTraceEvent[] {
    return structuredClone(JSON.parse(raw) as AgentTraceEvent[]);
  }

  protected serialize(value: AgentTraceEvent[]): string {
    return `${JSON.stringify(this.cloneValue(value), null, 2)}\n`;
  }

  protected cloneValue(value: AgentTraceEvent[]): AgentTraceEvent[] {
    return structuredClone(value);
  }

  private loadCurrentEvents(): AgentTraceEvent[] {
    return this.getBufferedValue(TRACE_BUFFER_KEY) ?? [];
  }
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
