import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  RuntimeApi,
} from "../interface/api.js";
import { FileStorage, type Storage } from "../data/storage.js";
import { ContextAssembler } from "../context/context-assembler.js";
import { RetrievalProvider } from "../context/retrieval-provider.js";
import { RuntimeMemory } from "../context/runtime-memory.js";
import { SessionTranscript } from "../context/session-transcript.js";
import { createBuiltInToolHandlers } from "../capability/built-in-tools.js";
import { ExecutionEnvironment } from "../capability/execution-environment.js";
import { McpGateway } from "../capability/mcp-gateway.js";
import { RuntimePermissionPolicy } from "../capability/permission-policy.js";
import { McpToolRegistry } from "../capability/tool-registry.js";
import { AgentSelector } from "../orchestration/agent-selector.js";
import { ChatAgent, ChatPromptBuilder, ChatResultChecker } from "../orchestration/chat-agent.js";
import {
  ExecutionResultChecker,
  ObservationChecker as PeoObservationChecker,
  PEOAgent,
  PlanChecker,
  PlanPromptBuilder,
  TaskExecutor as PeoTaskExecutor,
} from "../orchestration/peo-agent.js";
import {
  ActionResultChecker,
  ObservationChecker as ReactObservationChecker,
  ReActAgent,
  TaskExecutor as ReactTaskExecutor,
  ThoughtChecker,
  ThoughtPromptBuilder,
} from "../orchestration/react-agent.js";
import { Metrics } from "../observability/metrics.js";
import { Trace } from "../observability/trace.js";
import { ModelFactory } from "../model/model-factory.js";
import { AgentSession } from "./agent-session.js";
import { AgentSessionManager } from "./agent-session-manager.js";
import { RunCheckpoint } from "./run-checkpoint.js";
import {
  loadRequiredRealProviderConfig,
  toRuntimeModelConfig,
} from "./workspace-local-env.js";
import type {
  RuntimeModelConfig,
  RuntimeServices,
} from "./types.js";

export interface RuntimeOptions {
  workdir: string;
  defaultModelMode?: "mock" | "real_from_local_env";
  realProviderFetchFn?: import("../model/types.js").FetchLike;
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
    const sessionTranscript = new SessionTranscript(this.storage);
    const runtimeMemory = new RuntimeMemory(this.storage);
    const contextAssembler = new ContextAssembler(
      sessionTranscript,
      runtimeMemory,
      new RetrievalProvider(options.workdir),
    );
    const permissionPolicy = new RuntimePermissionPolicy([options.workdir]);
    const toolRegistry = new McpToolRegistry(createBuiltInToolHandlers(options.workdir));
    const executionEnvironment = new ExecutionEnvironment();
    const trace = new Trace(this.storage);
    const gateway = new McpGateway(permissionPolicy, toolRegistry, executionEnvironment);
    const modelFactory = new ModelFactory();
    const chatAgent = new ChatAgent(
      modelFactory,
      new ChatPromptBuilder(),
      new ChatResultChecker(),
      trace,
    );
    const reactAgent = new ReActAgent(
      modelFactory,
      new ThoughtPromptBuilder(),
      new ThoughtChecker(),
      new ReactTaskExecutor(gateway),
      new ActionResultChecker(),
      new ReactObservationChecker(),
      trace,
    );
    const peoAgent = new PEOAgent(
      modelFactory,
      new PlanPromptBuilder(),
      new PlanChecker(),
      new PeoTaskExecutor(gateway),
      new ExecutionResultChecker(),
      new PeoObservationChecker(),
      trace,
    );
    this.services = {
      storageRoot: path.join(options.workdir, ".agent_runtime"),
      contextAssembler,
      sessionTranscript,
      runtimeMemory,
      agentSelector: new AgentSelector({
        chatAgent,
        reactAgent,
        peoAgent,
      }),
      metrics: new Metrics(this.storage),
      trace,
      checkpoint: new RunCheckpoint(this.storage),
      resolveDefaultModelConfig: async (): Promise<RuntimeModelConfig> => {
        if (options.defaultModelMode === "real_from_local_env") {
          const config = await loadRequiredRealProviderConfig(options.workdir);
          return toRuntimeModelConfig({
            ...config,
            fetchFn: options.realProviderFetchFn,
          });
        }
        return {
          mock: true,
          modeSelection: {},
        };
      },
    };
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    await this.services.trace.record({
      traceId: randomUUID(),
      scope: "sdk",
      eventType: "session_create_requested",
      timestamp: new Date().toISOString(),
      caller: "Runtime",
      summary: "session create requested",
    });
    const sessionId = randomUUID();
    const session = await AgentSession.create({ ...input, sessionId }, this.storage, this.services);
    await this.sessionManager.put(sessionId, session);
    await this.services.trace.record({
      traceId: randomUUID(),
      scope: "sdk",
      eventType: "session_created",
      timestamp: new Date().toISOString(),
      caller: "Runtime",
      summary: "session created",
      sessionId,
    });
    await this.services.trace.flush();
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to open a session.");
    }
    await this.services.trace.record({
      traceId: randomUUID(),
      scope: "sdk",
      eventType: "session_open_requested",
      timestamp: new Date().toISOString(),
      caller: "Runtime",
      summary: "session open requested",
      sessionId,
    });
    const cached = await this.sessionManager.get(sessionId);
    if (cached instanceof AgentSession) {
      await this.services.trace.record({
        traceId: randomUUID(),
        scope: "sdk",
        eventType: "session_opened",
        timestamp: new Date().toISOString(),
        caller: "Runtime",
        summary: "session opened from cache",
        sessionId,
      });
      await this.services.trace.flush();
      return cached;
    }
    const session = await AgentSession.open(sessionId, this.storage, this.services);
    await this.sessionManager.put(sessionId, session);
    await this.services.trace.record({
      traceId: randomUUID(),
      scope: "sdk",
      eventType: "session_opened",
      timestamp: new Date().toISOString(),
      caller: "Runtime",
      summary: "session opened",
      sessionId,
    });
    await this.services.trace.flush();
    return session;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to close a session.");
    }
    const cached = await this.sessionManager.get(sessionId);
    const session = cached instanceof AgentSession
      ? cached
      : await AgentSession.loadForClose(sessionId, this.storage, this.services);
    if (session.isRunning()) {
      throw new Error(`Session ${sessionId} is running and cannot be closed.`);
    }
    await session.close();
    await this.sessionManager.remove(sessionId);
    await this.services.trace.record({
      traceId: randomUUID(),
      scope: "sdk",
      eventType: "session_closed",
      timestamp: new Date().toISOString(),
      caller: "Runtime",
      summary: "session closed",
      sessionId,
    });
    await this.services.trace.flush();
    return { sessionId };
  }
}

export function createRuntime(options: RuntimeOptions): Runtime {
  return new Runtime(options);
}
