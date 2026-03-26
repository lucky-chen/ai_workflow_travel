import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AgentTraceEvent,
  IAgentTraceRecorder,
  TokenUsageSummary,
} from "./agent-runtime-types.js";
import { createEmptyTokenUsageSummary } from "./agent-runtime-types.js";

export class FileAgentTraceRecorder implements IAgentTraceRecorder {
  private readonly events: AgentTraceEvent[] = [];
  private pendingCount = 0;

  constructor(
    private readonly outputPath: string,
    private readonly flushThreshold = 3,
  ) {}

  async record(event: AgentTraceEvent): Promise<void> {
    this.events.push(event);
    this.pendingCount += 1;

    if (this.shouldFlush(event)) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.pendingCount === 0) {
      return;
    }

    await mkdir(path.dirname(this.outputPath), { recursive: true });
    await writeFile(this.outputPath, `${JSON.stringify(this.events, null, 2)}\n`, "utf8");
    this.pendingCount = 0;
  }

  private shouldFlush(event: AgentTraceEvent): boolean {
    return (
      this.pendingCount >= this.flushThreshold
      || event.eventType === "run_finished"
      || event.eventType === "session_closed"
    );
  }

  summarizeSessionUsage(sessionId: string): TokenUsageSummary {
    return this.events
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
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
