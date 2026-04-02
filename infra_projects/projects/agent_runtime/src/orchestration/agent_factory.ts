import type { McpGateway, McpToolRegistry } from "../capability/types.js";
import type { ModelFactory } from "../model/model-factory.js";
import type { ModelConfig } from "../model/types.js";
import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";
import type { AgentCreateOptions } from "../interface/agent-api.js";
import { createChatAgent } from "./chat_agent/index.js";
import { createPEOAgent } from "./peo_agent/index.js";
import { createReActAgent } from "./react_agent/index.js";
import type { AgentRunMode, IAgent } from "../interface/agent-api.js";
import type { AgentFactory as AgentFactoryContract } from "./types.js";

export interface AgentFactoryOptions {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  eventBus: RuntimeEventBus;
  toolRegistry: McpToolRegistry;
  sysPrompt?: AgentCreateOptions["sysPrompt"];
}

export class AgentFactory implements AgentFactoryContract {
  constructor(private readonly options: AgentFactoryOptions) {}

  async create(mode: AgentRunMode, overrides: { modelConfig?: ModelConfig } = {}): Promise<IAgent> {
    const modelFactory = overrides.modelConfig
      ? this.options.modelFactory.withDefaultConfig(overrides.modelConfig)
      : this.options.modelFactory;
    if (mode === "chat") {
      return createChatAgent({
        modelFactory,
        eventBus: this.options.eventBus,
        sysPrompt: this.options.sysPrompt ?? [],
      });
    }
    if (mode === "react") {
      return createReActAgent({
        modelFactory,
        gateway: this.options.gateway,
        eventBus: this.options.eventBus,
        toolRegistry: this.options.toolRegistry,
        sysPrompt: this.options.sysPrompt ?? [],
      });
    }
    if (mode === "peo") {
      return createPEOAgent({
        modelFactory,
        gateway: this.options.gateway,
        eventBus: this.options.eventBus,
        toolRegistry: this.options.toolRegistry,
        sysPrompt: this.options.sysPrompt ?? [],
      });
    }
    return assertNever(mode);
  }
}

function assertNever(mode: never): IAgent {
  throw new Error(`Unsupported agent mode: ${String(mode)}`);
}
