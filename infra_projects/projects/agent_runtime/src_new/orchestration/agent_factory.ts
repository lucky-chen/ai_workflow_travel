import type { McpGateway, McpToolRegistry } from "../capability/types.js";
import type { ModelFactory } from "../model/model-factory.js";
import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";
import { createChatAgent } from "./chat_agent/index.js";
import { createPEOAgent } from "./peo_agent/index.js";
import { createReActAgent } from "./react_agent/index.js";
import type { AgentRunMode } from "../interface/api.js";
import type { AgentFactory as AgentFactoryContract, IAgent } from "./types.js";

export interface AgentFactoryOptions {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  eventBus: RuntimeEventBus;
  toolRegistry: McpToolRegistry;
}

export class AgentFactory implements AgentFactoryContract {
  constructor(private readonly options: AgentFactoryOptions) {}

  async create(mode: AgentRunMode): Promise<IAgent> {
    if (mode === "chat") {
      return createChatAgent({
        modelFactory: this.options.modelFactory,
        eventBus: this.options.eventBus,
      });
    }
    if (mode === "react") {
      return createReActAgent({
        modelFactory: this.options.modelFactory,
        gateway: this.options.gateway,
        eventBus: this.options.eventBus,
        toolRegistry: this.options.toolRegistry,
      });
    }
    if (mode === "peo") {
      return createPEOAgent({
        modelFactory: this.options.modelFactory,
        gateway: this.options.gateway,
        eventBus: this.options.eventBus,
        toolRegistry: this.options.toolRegistry,
      });
    }
    return assertNever(mode);
  }
}

function assertNever(mode: never): IAgent {
  throw new Error(`Unsupported agent mode: ${String(mode)}`);
}
