import path from "node:path";

import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { FetchLike, ModelConfig } from "../model/types.js";
import { FileStorage, type Storage } from "../data/storage.js";
import { createBuiltInToolDefinitions } from "../capability/built-in-tools.js";
import { ExecutionEnvironment } from "../capability/execution-environment.js";
import { McpGateway } from "../capability/mcp-gateway.js";
import { RuntimePermissionPolicy } from "../capability/permission-policy.js";
import { RuntimeEventBus, type RuntimeEventListener } from "../capability/runtime-event-bus.js";
import { McpToolRegistry } from "../capability/tool-registry.js";
import { AgentFactory } from "../orchestration/agent_factory.js";
import { createIntentRouter } from "../orchestration/intent_router/index.js";
import { createMetrics } from "../observability/metrics.js";
import { createTrace } from "../observability/trace.js";
import { TraceRuntimeEventListener } from "../observability/trace-runtime-event-listener.js";
import { ModelFactory } from "../model/model-factory.js";
import { createRunCheckpoint } from "./run-checkpoint.js";
import { registerExternalToolProviders } from "./external-tool-registration.js";
import { toRuntimeModelConfig, WorkspaceLocalEnv } from "./workspace-local-env.js";
import type { RuntimeSharedComponents } from "./types.js";

export interface RuntimeAssemblyOptions {
  workdir: string;
  serviceScope: "agent_service" | "session_service";
  defaultModelMode?: "mock" | "real_from_local_env";
  realProviderFetchFn?: FetchLike;
  externalMcpEndpoints?: ExternalMcpEndpointConfig[];
}

export interface RuntimeAssemblyOverrides {
  eventListeners?: RuntimeEventListener[];
}

export class RuntimeAssembly {
  readonly storage: Storage;
  readonly components: RuntimeSharedComponents;
  readonly initialization: Promise<void>;

  constructor(
    runtimeRunId: string,
    options: RuntimeAssemblyOptions,
    overrides: RuntimeAssemblyOverrides = {},
  ) {
    if (!options.workdir) {
      throw new Error("Runtime requires workdir.");
    }

    const storageRoot = path.join(options.workdir, ".agent_runtime", options.serviceScope);
    this.storage = new FileStorage(storageRoot);
    const permissionPolicy = new RuntimePermissionPolicy(options.workdir, [options.workdir]);
    const toolRegistry = new McpToolRegistry(createBuiltInToolDefinitions(options.workdir));
    const executionEnvironment = new ExecutionEnvironment();
    const trace = createTrace(this.storage, runtimeRunId);
    const eventBus = new RuntimeEventBus([
      new TraceRuntimeEventListener(trace),
      ...(overrides.eventListeners ?? []),
    ]);
    const gateway = new McpGateway(permissionPolicy, toolRegistry, executionEnvironment, eventBus);
    const workspaceLocalEnv = new WorkspaceLocalEnv(options.workdir);
    const localEnvLoading = workspaceLocalEnv.load({
      optional: options.defaultModelMode !== "real_from_local_env",
    });

    const resolveDefaultModelConfig = async (): Promise<ModelConfig> => {
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
    const modelFactory = new ModelFactory(eventBus, resolveDefaultModelConfig);

    const intentRouter = createIntentRouter({
      modelFactory,
    });

    this.initialization = registerExternalToolProviders({
      localEnv: workspaceLocalEnv,
      configuredMcpEndpoints: options.externalMcpEndpoints,
      localEnvLoading,
      toolRegistry,
      eventBus,
    });

    this.components = {
      storageRoot,
      storage: this.storage,
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
    };
  }
}
