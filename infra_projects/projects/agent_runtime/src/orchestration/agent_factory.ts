import type { McpGateway, McpToolRegistry } from "../capability/types.js";
import type { ModelFactory } from "../model/model-factory.js";
import type { ModelConfig } from "../model/types.js";
import { createChatAgent } from "./chat_agent/index.js";
import { createPEOAgent } from "./peo_agent/index.js";
import { createReActAgent } from "./react_agent/index.js";
import type { AgentType, IAgent } from "../interface/agent-api.js";
import type { AgentFactory as AgentFactoryContract } from "./types.js";
import type { Trace } from "../observability/trace.js";

export interface AgentFactoryOptions {
  modelFactory: ModelFactory;
  gateway: McpGateway;
  toolRegistry: McpToolRegistry;
}

export class AgentFactory implements AgentFactoryContract {
  constructor(private readonly options: AgentFactoryOptions) {}

  create(
    type: AgentType,
    overrides: { modelConfig?: ModelConfig; sysPrompt?: string[]; trace?: Trace } = {},
  ): IAgent {
    let modelFactory = overrides.trace
      ? this.options.modelFactory.withTrace(overrides.trace)
      : this.options.modelFactory;
    modelFactory = overrides.modelConfig
      ? modelFactory.withDefaultConfig(overrides.modelConfig)
      : modelFactory;
    const gateway = overrides.trace
      ? this.options.gateway.withTrace(overrides.trace)
      : this.options.gateway;
    const sysPrompt = overrides.sysPrompt ?? [];
    if (type === "chat") {
      return createChatAgent({
        modelFactory,
        sysPrompt,
      });
    }
    if (type === "react") {
      return createReActAgent({
        modelFactory,
        gateway,
        toolRegistry: this.options.toolRegistry,
        sysPrompt,
      });
    }
    if (type === "peo") {
      return createPEOAgent({
        modelFactory,
        gateway,
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
