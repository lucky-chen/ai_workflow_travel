import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  RuntimeApi,
} from "../interface/api.js";
import { FileStorage, type Storage } from "../data/storage.js";
import { ContextAssembler } from "../context/context-assembler.js";
import { LocalFileRetrievalProvider } from "../context/retrieval-provider.js";
import { StorageBackedRuntimeMemory } from "../context/runtime-memory.js";
import { StorageBackedSessionTranscript } from "../context/session-transcript.js";
import { createBuiltInToolHandlers } from "../capability/built-in-tools.js";
import { LocalExecutionEnvironment } from "../capability/execution-environment.js";
import { DefaultMcpGateway } from "../capability/mcp-gateway.js";
import { DefaultRuntimePermissionPolicy } from "../capability/permission-policy.js";
import { InMemoryMcpToolRegistry } from "../capability/tool-registry.js";
import { DefaultAgentSelector } from "../orchestration/agent-selector.js";
import { ChatAgent, ChatPromptBuilder, ChatResultChecker } from "../orchestration/chat-agent.js";
import { ReservedMultiAgentProtocol } from "../orchestration/multi-agent-protocol.js";
import { PEOAgent } from "../orchestration/peo-agent.js";
import { ReActAgent } from "../orchestration/react-agent.js";
import { StorageBackedMetrics } from "../observability/metrics.js";
import { StorageBackedTrace } from "../observability/trace.js";
import { DefaultModelFactory } from "../model/model-factory.js";
import { AgentSession } from "./agent-session.js";
import { AgentSessionManager } from "./agent-session-manager.js";
import { ReservedRunCheckpoint } from "./run-checkpoint.js";
import type { RuntimeServices } from "./types.js";

export interface RuntimeOptions {
  workdir: string;
}

export class Runtime implements RuntimeApi {
  private readonly storage: Storage;
  private readonly sessionManager = new AgentSessionManager();
  private readonly services: RuntimeServices;

  constructor(private readonly options: RuntimeOptions) {
    if (!options.workdir) {
      throw new Error("Runtime requires workdir.");
    }
    this.storage = new FileStorage(path.join(options.workdir, ".agent_runtime"));
    const sessionTranscript = new StorageBackedSessionTranscript(this.storage);
    const runtimeMemory = new StorageBackedRuntimeMemory(this.storage);
    const contextAssembler = new ContextAssembler(
      sessionTranscript,
      runtimeMemory,
      new LocalFileRetrievalProvider(options.workdir),
    );
    const permissionPolicy = new DefaultRuntimePermissionPolicy([options.workdir]);
    const toolRegistry = new InMemoryMcpToolRegistry(createBuiltInToolHandlers(options.workdir));
    const executionEnvironment = new LocalExecutionEnvironment();
    const trace = new StorageBackedTrace(this.storage);
    const gateway = new DefaultMcpGateway(permissionPolicy, toolRegistry, executionEnvironment);
    const modelFactory = new DefaultModelFactory();
    const chatAgent = new ChatAgent(
      modelFactory,
      new ChatPromptBuilder(),
      new ChatResultChecker(),
      trace,
      gateway,
    );
    const reactAgent = new ReActAgent(modelFactory, gateway, trace);
    const peoAgent = new PEOAgent(modelFactory, gateway, trace);
    const _multiAgentProtocol = new ReservedMultiAgentProtocol();
    this.services = {
      storageRoot: path.join(options.workdir, ".agent_runtime"),
      contextAssembler,
      sessionTranscript,
      runtimeMemory,
      agentSelector: new DefaultAgentSelector({
        chatAgent,
        reactAgent,
        peoAgent,
      }),
      metrics: new StorageBackedMetrics(this.storage),
      trace,
      checkpoint: new ReservedRunCheckpoint(this.storage),
    };
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    const sessionId = randomUUID();
    const session = await AgentSession.create({ ...input, sessionId }, this.storage, this.services);
    await this.sessionManager.put(sessionId, session);
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    const cached = await this.sessionManager.get(sessionId);
    if (cached instanceof AgentSession) {
      return cached;
    }
    const session = await AgentSession.open(sessionId, this.storage, this.services);
    await this.sessionManager.put(sessionId, session);
    return session;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    const session = await this.openSession(sessionId);
    await session.close();
    await this.sessionManager.remove(sessionId);
    return { sessionId };
  }
}

export function createRuntime(options: RuntimeOptions): Runtime {
  return new Runtime(options);
}
