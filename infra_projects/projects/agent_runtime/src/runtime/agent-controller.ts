import type {
  AgentEventListener,
  AgentType,
  IAgent,
} from "../interface/agent-api.js";
import type { ModelConfig } from "../model/types.js";
import type { AgentRuntimeComponents } from "./types.js";
import { AgentEventMetricsRecorder } from "./agent-event-metrics-recorder.js";

export class AgentController {
  private readonly agentListeners = new WeakMap<IAgent, AgentEventListener>();
  private readonly eventMetricsRecorder: AgentEventMetricsRecorder;

  constructor(
    readonly components: AgentRuntimeComponents,
    private readonly initialization: Promise<void>,
  ) {
    this.eventMetricsRecorder = new AgentEventMetricsRecorder(
      components.metrics,
      initialization,
    );
  }

  async createAgent(type: AgentType): Promise<IAgent> {
    await this.initialization;
    const agent = this.components.agentFactory.create(type);
    const listener: AgentEventListener = {
      onEvent: async (event) => {
        await this.eventMetricsRecorder.handle(type, event);
      },
    };
    agent.subscribeEvents(listener);
    this.agentListeners.set(agent, listener);
    return agent;
  }

  closeAgent(agent: IAgent): Promise<void> {
    const listener = this.agentListeners.get(agent);
    if (listener) {
      agent.unsubscribeEvents(listener);
      this.agentListeners.delete(agent);
    }
    return Promise.resolve();
  }

  async createAgentInstance(
    type: AgentType,
    overrides: { modelConfig?: ModelConfig; sysPrompt?: string[] } = {},
  ): Promise<IAgent> {
    await this.initialization;
    return this.components.agentFactory.create(type, {
      modelConfig: overrides.modelConfig,
      sysPrompt: overrides.sysPrompt ?? [],
    });
  }
}
