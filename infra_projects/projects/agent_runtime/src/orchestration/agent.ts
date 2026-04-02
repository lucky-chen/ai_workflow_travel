import { randomUUID } from "node:crypto";

import type {
  AgentCreateOptions,
  AgentEvent,
  AgentEventListener,
  AgentRunInput,
  AgentRunMode,
  AgentRunResult,
  IAgent,
} from "../interface/agent-api.js";
import type { RuntimeEvent } from "../capability/runtime-event.js";
import type { RuntimeEventListener } from "../capability/runtime-event-bus.js";
import { mapRuntimeEventToTraceEvents } from "../observability/trace-runtime-event-listener.js";
import { RuntimeAssembly } from "../runtime/runtime-assembly.js";
import type { RuntimeComponents } from "../runtime/types.js";

class AgentEventBus {
  private readonly listeners = new Set<AgentEventListener>();

  subscribe(listener: AgentEventListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: AgentEventListener): void {
    this.listeners.delete(listener);
  }

  async publish(event: AgentEvent): Promise<void> {
    for (const listener of [...this.listeners]) {
      await listener.onEvent(event);
    }
  }
}

class AgentService implements IAgent {
  private readonly components: RuntimeComponents;
  private readonly initialization: Promise<void>;
  private readonly agentEventBus = new AgentEventBus();
  private readonly agentCacheMap = new Map<AgentRunMode, IAgent>();
  private readonly runtimeEventListener: RuntimeEventListener;
  private running = false;

  constructor(private readonly options: AgentCreateOptions) {
    const assembly = new RuntimeAssembly(randomUUID(), options);
    this.components = assembly.components;
    this.initialization = assembly.initialization;
    this.runtimeEventListener = {
      onEvent: async (event) => {
        await this.forwardRuntimeEvent(event);
      },
    };
    this.components.eventBus.subscribe(this.runtimeEventListener);
  }

  subscribeEvents(listener: AgentEventListener): void {
    this.agentEventBus.subscribe(listener);
  }

  unsubscribeEvents(listener: AgentEventListener): void {
    this.agentEventBus.unsubscribe(listener);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    if (this.running) {
      throw new Error("Agent is running.");
    }

    await this.initialization;
    this.running = true;
    const runId = randomUUID();
    const requestedMode = this.options.mode ?? await this.resolveMode(input);

    await this.agentEventBus.publish({
      timestamp: new Date().toISOString(),
      brief: "agent.run.started",
      details: {
        mode: requestedMode,
      },
    });

    try {
      const normalizedInput = await this.normalizeInput(input, requestedMode);
      const agent = await this.selectAgent(requestedMode);
      const result = await agent.run(normalizedInput);
      await this.components.metrics.collect({
        sessionId: runId,
        result: {
          sessionId: runId,
          content: result.content,
          format: result.format,
          errorCode: result.errorInfo?.code,
          errorMessage: result.errorInfo?.message,
        },
        providerUsageFacts: {
          promptTokens: result.tokenUsage?.inputTokens ?? 0,
          completionTokens: result.tokenUsage?.outputTokens ?? 0,
        },
        runScope: {
          runId,
          agentName: requestedMode,
        },
      });
      await this.components.metrics.flush();
      await this.components.trace.flush();
      await this.agentEventBus.publish({
        timestamp: new Date().toISOString(),
        brief: result.errorInfo ? "agent.run.failed" : "agent.run.finished",
        details: omitUndefined({
          mode: requestedMode,
          format: result.format,
          errorCode: result.errorInfo?.code,
          errorMessage: result.errorInfo?.message,
        }),
      });
      return result;
    } catch (error) {
      const failure: AgentRunResult = {
        format: "text",
        errorInfo: {
          code: "AGENT_RUN_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
      await this.components.metrics.collect({
        sessionId: runId,
        result: {
          sessionId: runId,
          format: failure.format,
          errorCode: failure.errorInfo?.code,
          errorMessage: failure.errorInfo?.message,
        },
        toolExecutionFacts: {
          toolCalls: 0,
          failedToolCalls: 0,
        },
        runScope: {
          runId,
          agentName: requestedMode,
        },
      });
      await this.components.metrics.flush();
      await this.components.trace.flush();
      await this.agentEventBus.publish({
        timestamp: new Date().toISOString(),
        brief: "agent.run.failed",
        details: {
          mode: requestedMode,
          errorCode: failure.errorInfo?.code,
          errorMessage: failure.errorInfo?.message,
        },
      });
      return failure;
    } finally {
      this.running = false;
    }
  }

  private async resolveMode(input: AgentRunInput): Promise<AgentRunMode> {
    return (await this.components.intentRouter.resolve({
      userInput: {
        content: input.userInput,
      },
    })).mode;
  }

  private async normalizeInput(input: AgentRunInput, requestedMode: AgentRunMode): Promise<AgentRunInput> {
    return input;
  }

  private async selectAgent(requestedMode: AgentRunMode): Promise<IAgent> {
    const cached = this.agentCacheMap.get(requestedMode);
    if (cached) {
      return cached;
    }

    const agent = await this.components.agentFactory.create(requestedMode);
    this.agentCacheMap.set(requestedMode, agent);
    return agent;
  }

  private async forwardRuntimeEvent(event: RuntimeEvent): Promise<void> {
    for (const traceEvent of mapRuntimeEventToTraceEvents(event)) {
      if (traceEvent.type === "runtime") {
        continue;
      }
      await this.agentEventBus.publish({
        timestamp: typeof traceEvent.metadata.timestamp === "string"
          ? traceEvent.metadata.timestamp
          : new Date().toISOString(),
        brief: traceEvent.brief,
        details: traceEvent.details,
      });
    }
  }
}

export function createAgent(options: AgentCreateOptions): IAgent {
  return new AgentService(options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
