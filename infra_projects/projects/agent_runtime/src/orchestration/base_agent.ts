import { randomUUID } from "node:crypto";

import type { RuntimeEvent } from "../capability/runtime-event.js";
import type { RuntimeEventBus, RuntimeEventListener } from "../capability/runtime-event-bus.js";
import type { AgentEvent, AgentEventListener, AgentRunInput, AgentRunResult, AgentType, IAgent } from "../interface/agent-api.js";
import { mapRuntimeEventToTraceEvents } from "../observability/trace-runtime-event-listener.js";

export abstract class BaseAgent implements IAgent {
  private readonly listeners = new Set<AgentEventListener>();
  private readonly runtimeEventListener: RuntimeEventListener;
  private subscribedToRuntime = false;
  private running = false;
  private activeRunId?: string;

  protected constructor(
    protected readonly agentType: AgentType,
    private readonly runtimeEventBus: RuntimeEventBus,
  ) {
    this.runtimeEventListener = {
      onEvent: async (event) => {
        await this.forwardRuntimeEvent(event);
      },
    };
  }

  subscribeEvents(listener: AgentEventListener): void {
    const wasEmpty = this.listeners.size === 0;
    this.listeners.add(listener);
    if (wasEmpty && this.listeners.size > 0 && !this.subscribedToRuntime) {
      this.runtimeEventBus.subscribe(this.runtimeEventListener);
      this.subscribedToRuntime = true;
    }
  }

  unsubscribeEvents(listener: AgentEventListener): void {
    this.listeners.delete(listener);
    if (this.listeners.size === 0 && this.subscribedToRuntime) {
      this.runtimeEventBus.unsubscribe(this.runtimeEventListener);
      this.subscribedToRuntime = false;
    }
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    if (this.running) {
      throw new Error("Agent is running.");
    }

    this.running = true;
    const runId = randomUUID();
    this.activeRunId = runId;
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
      this.activeRunId = undefined;
      this.running = false;
    }
  }

  protected abstract execute(input: AgentRunInput, runId: string): Promise<AgentRunResult>;

  protected async publish(event: AgentEvent): Promise<void> {
    for (const listener of [...this.listeners]) {
      await listener.onEvent(event);
    }
  }

  private async forwardRuntimeEvent(event: RuntimeEvent): Promise<void> {
    if (!this.shouldForwardRuntimeEvent(event)) {
      return;
    }
    for (const traceEvent of mapRuntimeEventToTraceEvents(event)) {
      if (traceEvent.type === "runtime") {
        continue;
      }
      await this.publish({
        timestamp: typeof traceEvent.metadata.timestamp === "string"
          ? traceEvent.metadata.timestamp
          : new Date().toISOString(),
        brief: traceEvent.brief,
        details: traceEvent.details,
      });
    }
  }

  private shouldForwardRuntimeEvent(event: RuntimeEvent): boolean {
    if (!this.activeRunId) {
      return false;
    }
    if (event.type === "agent") {
      return event.agentMessage.traceId === this.activeRunId
        && event.agentMessage.agent.name === this.agentType;
    }
    if (event.type === "tool") {
      return typeof event.toolMessage.traceId === "string"
        && event.toolMessage.traceId.startsWith(this.activeRunId)
        && event.toolMessage.agent.name === this.agentType;
    }
    return false;
  }
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
