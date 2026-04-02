import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { FetchLike } from "../model/types.js";
import { randomUUID } from "node:crypto";

import { AgentService } from "../runtime/agent-service.js";
import { RuntimeAssembly } from "../runtime/runtime-assembly.js";

export type { FetchLike } from "../model/types.js";

export type AgentType = "chat" | "react" | "peo";

export interface AgentCreateOptions {
  workdir: string;
  type?: AgentType;
  sysPrompt?: string[];
  defaultModelMode?: "mock" | "real_from_local_env";
  realProviderFetchFn?: FetchLike;
  externalMcpEndpoints?: ExternalMcpEndpointConfig[];
}

export interface AgentApi {
  createAgent(type?: AgentType): Promise<IAgent>;
  closeAgent(agent: IAgent): Promise<void>;
}

export interface AgentRunInput {
  userInput: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface AgentRunResult {
  content?: string | Record<string, unknown>;
  format?: "text" | "json";
  errorInfo?: {
    code: string;
    message: string;
  };
  metrics?: {
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    toolUsage?: {
      toolCalls: number;
      failedToolCalls: number;
    };
  };
  custom?: Record<string, unknown>;
}

export interface AgentEvent {
  timestamp: string;
  brief: string;
  details?: Record<string, unknown>;
}

export interface AgentEventListener {
  onEvent(event: AgentEvent): Promise<void> | void;
}

export interface IAgent {
  run(input: AgentRunInput): Promise<AgentRunResult>;
  subscribeEvents(listener: AgentEventListener): void;
  unsubscribeEvents(listener: AgentEventListener): void;
}

export function createAgentApi(options: AgentCreateOptions): AgentApi {
  const assembly = new RuntimeAssembly(randomUUID(), {
    workdir: options.workdir,
    defaultModelMode: options.defaultModelMode,
    realProviderFetchFn: options.realProviderFetchFn,
    externalMcpEndpoints: options.externalMcpEndpoints,
  });
  const agentService = new AgentService(assembly.components, assembly.initialization);

  return {
    async createAgent(type?: AgentType): Promise<IAgent> {
      return agentService.createAgentInstance(type ?? options.type ?? "chat", {
        sysPrompt: options.sysPrompt,
      });
    },
    async closeAgent(agent: IAgent): Promise<void> {
      await agentService.closeAgent(agent);
    },
  };
}
