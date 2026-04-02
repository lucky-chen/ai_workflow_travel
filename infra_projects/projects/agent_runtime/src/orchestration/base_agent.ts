import { randomUUID } from "node:crypto";

import type { AgentEvent, AgentEventListener, AgentRunInput, AgentRunResult, AgentType, IAgent } from "../interface/agent-api.js";

export abstract class BaseAgent implements IAgent {
  private readonly listeners = new Set<AgentEventListener>();
  private running = false;

  protected constructor(protected readonly agentType: AgentType) {}

  subscribeEvents(listener: AgentEventListener): void {
    this.listeners.add(listener);
  }

  unsubscribeEvents(listener: AgentEventListener): void {
    this.listeners.delete(listener);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    if (this.running) {
      throw new Error("Agent is running.");
    }

    this.running = true;
    const runId = randomUUID();
    try {
      const result = await this.execute(input, runId);
      await this.publish({
        timestamp: new Date().toISOString(),
        brief: result.errorInfo ? "agent.run.failed" : "agent.run.finished",
        details: omitUndefined({
          type: this.agentType,
          runId,
          format: result.format,
          errorCode: result.errorInfo?.code,
          errorMessage: result.errorInfo?.message,
          metrics: result.metrics,
        }),
      });
      return result;
    } finally {
      this.running = false;
    }
  }

  protected abstract execute(input: AgentRunInput, runId: string): Promise<AgentRunResult>;

  protected async publish(event: AgentEvent): Promise<void> {
    for (const listener of [...this.listeners]) {
      await listener.onEvent(event);
    }
  }

  async publishInternal(event: AgentEvent): Promise<void> {
    await this.publish(event);
  }
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
