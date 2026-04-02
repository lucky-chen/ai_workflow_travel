import type { McpGateway, McpToolRegistry } from "../capability/types.js";
import type { ModelFactory } from "../model/model-factory.js";
import type { ModelConfig } from "../model/types.js";
import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";
import type { AgentCreateOptions } from "../interface/agent-api.js";
import { createChatAgent } from "./chat_agent/index.js";
import { createPEOAgent } from "./peo_agent/index.js";
import { createReActAgent } from "./react_agent/index.js";
import type { AgentType, IAgent } from "../interface/agent-api.js";
import type { AgentFactory as AgentFactoryContract } from "./types.js";

export interface AgentFactoryOptions {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  eventBus: RuntimeEventBus;
  toolRegistry: McpToolRegistry;
}

export class AgentFactory implements AgentFactoryContract {
  constructor(private readonly options: AgentFactoryOptions) {}

  create(
    type: AgentType,
    overrides: { modelConfig?: ModelConfig; sysPrompt?: string[] } = {},
  ): IAgent {
    const modelFactory = overrides.modelConfig
      ? this.options.modelFactory.withDefaultConfig(overrides.modelConfig)
      : this.options.modelFactory;
    const sysPrompt = overrides.sysPrompt ?? [];
    if (type === "chat") {
      return createChatAgent({
        modelFactory,
        eventBus: this.options.eventBus,
        sysPrompt,
      });
    }
    if (type === "react") {
      return createReActAgent({
        modelFactory,
        gateway: this.options.gateway,
        eventBus: this.options.eventBus,
        toolRegistry: this.options.toolRegistry,
        sysPrompt,
      });
    }
    if (type === "peo") {
      return createPEOAgent({
        modelFactory,
        gateway: this.options.gateway,
        eventBus: this.options.eventBus,
        toolRegistry: this.options.toolRegistry,
        sysPrompt,
      });
    }
    return assertNever(type);
  }
}

function assertNever(type: never): IAgent {
  throw new Error(`Unsupported agent type: ${String(type)}`);
}
