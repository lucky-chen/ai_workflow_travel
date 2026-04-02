import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  RuntimeApi,
  RuntimeCreateOptions,
} from "../interface/api.js";
import { FileStorage, type Storage } from "../data/storage.js";
import { ContextAssembler } from "../context/context-assembler.js";
import { createRetrievalProvider } from "../context/retrieval-provider.js";
import { createRuntimeMemory } from "../context/runtime-memory.js";
import { createSessionTranscript } from "../context/session-transcript.js";
import { createBuiltInToolDefinitions } from "../capability/built-in-tools.js";
import { ExecutionEnvironment } from "../capability/execution-environment.js";
import { McpGateway } from "../capability/mcp-gateway.js";
import { RuntimePermissionPolicy } from "../capability/permission-policy.js";
import { McpToolRegistry } from "../capability/tool-registry.js";
import { AgentFactory } from "../orchestration/agent_factory.js";
import { createIntentRouter } from "../orchestration/intent_router/index.js";
import { createMetrics } from "../observability/metrics.js";
import { createTrace } from "../observability/trace.js";
import { TraceRuntimeEventListener } from "../observability/trace-runtime-event-listener.js";
import { ModelFactory } from "../model/model-factory.js";
import { AgentSession } from "./agent-session.js";
import { AgentSessionManager } from "./agent-session-manager.js";
import { registerExternalToolProviders } from "./external-tool-registration.js";
import {
  CallbackRuntimeEventListener,
  RuntimeEventBus,
  type RuntimeEventListener,
} from "../capability/runtime-event-bus.js";
import { createRunCheckpoint } from "./run-checkpoint.js";
import {
  toRuntimeModelConfig,
  WorkspaceLocalEnv,
} from "./workspace-local-env.js";
import type {
  RuntimeModelConfig,
  RuntimeServices,
} from "./types.js";

export class Runtime implements RuntimeApi {
  private readonly storage: Storage;
  private readonly sessionManager = new AgentSessionManager();
  private readonly services: RuntimeServices;
  private readonly runtimeRunId = randomUUID();
  private readonly initialization: Promise<void>;

  constructor(private readonly options: RuntimeCreateOptions) {
    if (!options.workdir) {
      throw new Error("Runtime requires workdir.");
    }
    this.storage = new FileStorage(path.join(options.workdir, ".agent_runtime"));
    const sessionTranscript = createSessionTranscript(this.storage);
    const runtimeMemory = createRuntimeMemory(this.storage);
    const contextAssembler = new ContextAssembler(
      sessionTranscript,
      runtimeMemory,
      createRetrievalProvider(options.workdir),
    );
    const permissionPolicy = new RuntimePermissionPolicy(options.workdir, [options.workdir]);
    const toolRegistry = new McpToolRegistry(createBuiltInToolDefinitions(options.workdir));
    const executionEnvironment = new ExecutionEnvironment();
    const trace = createTrace(this.storage, this.runtimeRunId);
    const eventListeners: RuntimeEventListener[] = [new TraceRuntimeEventListener(trace)];
    if (options.eventCallback) {
      eventListeners.push(new CallbackRuntimeEventListener(options.eventCallback));
    }
    const eventBus = new RuntimeEventBus(eventListeners);
    const gateway = new McpGateway(permissionPolicy, toolRegistry, executionEnvironment, eventBus);
    const modelFactory = new ModelFactory(eventBus);
    const workspaceLocalEnv = new WorkspaceLocalEnv(options.workdir);
    const localEnvLoading = workspaceLocalEnv.load({
      optional: options.defaultModelMode !== "real_from_local_env",
    });
    const resolveDefaultModelConfig = async (): Promise<RuntimeModelConfig> => {
      if (options.defaultModelMode === "real_from_local_env") {
        const loaded = await localEnvLoading;
        if (!loaded) {
          throw new Error(`Missing local env file: ${path.join(options.workdir, "sdlc", "local_env.json")}`);
        }
        const config = workspaceLocalEnv.getRequiredRealProviderConfig(loaded);
        return toRuntimeModelConfig({
          ...config,
          fetchFn: options.realProviderFetchFn,
        });
      }
      return {
        mock: true,
        modeSelection: {},
      };
    };
    const intentRouter = createIntentRouter({
      modelFactory,
      resolveModelConfig: resolveDefaultModelConfig,
    });
    this.initialization = registerExternalToolProviders({
      localEnv: workspaceLocalEnv,
      configuredMcpEndpoints: options.externalMcpEndpoints,
      localEnvLoading,
      toolRegistry,
      eventBus,
    });
    this.services = {
      storageRoot: path.join(options.workdir, ".agent_runtime"),
      contextAssembler,
      sessionTranscript,
      runtimeMemory,
      intentRouter,
      agentFactory: new AgentFactory({
        modelFactory,
        gateway,
        eventBus,
        toolRegistry,
      }),
      metrics: createMetrics(this.storage),
      trace,
      eventBus,
      checkpoint: createRunCheckpoint(this.storage),
      resolveDefaultModelConfig,
    };
  }

  async createSession(input: AgentSessionAccessInput): Promise<AgentSession> {
    await this.initialization;
    await this.services.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_create_requested",
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        session: {
          mode: "create",
        },
      },
    });
    const sessionId = randomUUID();
    const session = await AgentSession.create({ ...input, sessionId }, this.storage, this.services);
    await this.sessionManager.put(sessionId, session);
    await this.services.trace.flush();
    return session;
  }

  async openSession(sessionId: string): Promise<AgentSession> {
    await this.initialization;
    if (!sessionId) {
      throw new Error("Runtime requires sessionId to open a session.");
    }
    await this.services.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_open_requested",
        sessionId,
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        session: {
          mode: "open",
        },
      },
    });
    const cached = await this.sessionManager.get(sessionId);
    if (cached instanceof AgentSession) {
      await this.services.eventBus.publish({
        type: "runtime",
        runtimeMessage: {
          event: "session_opened",
          sessionId,
          timestamp: new Date().toISOString(),
          session: {
            mode: "open",
          },
        },
      });
      await this.services.trace.flush();
      return cached;
    }
    const session = await AgentSession.open(sessionId, this.storage, this.services);
    await this.sessionManager.put(sessionId, session);
    await this.services.trace.flush();
    return session;
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    await this.initialization;
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
    await this.services.eventBus.publish({
      type: "runtime",
      runtimeMessage: {
        event: "session_closed",
        sessionId,
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        session: {
          mode: "close",
        },
      },
    });
    await this.services.trace.flush();
    return { sessionId };
  }
}

export function createRuntime(options: RuntimeCreateOptions): Runtime {
  return new Runtime(options);
}
