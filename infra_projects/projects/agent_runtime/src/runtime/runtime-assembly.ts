import path from "node:path";

import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { FetchLike, ModelConfig } from "../model/types.js";
import { FileStorage, type Storage } from "../data/storage.js";
import { createBuiltInToolDefinitions } from "../capability/built-in-tools.js";
import { ExecutionEnvironment } from "../capability/execution-environment.js";
import { McpGateway } from "../capability/mcp-gateway.js";
import { RuntimePermissionPolicy } from "../capability/permission-policy.js";
import { McpToolRegistry } from "../capability/tool-registry.js";
import { AgentFactory } from "../orchestration/agent_factory.js";
import { createMetrics } from "../observability/metrics.js";
import { ModelFactory } from "../model/model-factory.js";
import { createRunCheckpoint } from "./run-checkpoint.js";
import { registerExternalToolProviders } from "./external-tool-registration.js";
import { toRuntimeModelConfig, WorkspaceLocalEnv } from "./workspace-local-env.js";
import type { AgentRuntimeComponents } from "./types.js";

export interface RuntimeAssemblyOptions {
  workdir: string;
  defaultModelMode?: "mock" | "real_from_local_env";
  realProviderFetchFn?: FetchLike;
  externalMcpEndpoints?: ExternalMcpEndpointConfig[];
}

export interface RuntimeAssemblyOverrides {
}

export class RuntimeAssembly {
  readonly storage: Storage;
  readonly components: AgentRuntimeComponents;
  readonly initialization: Promise<void>;

  constructor(
    _runtimeRunId: string,
    options: RuntimeAssemblyOptions,
    overrides: RuntimeAssemblyOverrides = {},
  ) {
    if (!options.workdir) {
      throw new Error("Runtime requires workdir.");
    }

    const storageRoot = path.join(options.workdir, ".agent_runtime");
    this.storage = new FileStorage(storageRoot);
    const permissionPolicy = new RuntimePermissionPolicy(options.workdir, [options.workdir]);
    const toolRegistry = new McpToolRegistry(createBuiltInToolDefinitions(options.workdir));
    const executionEnvironment = new ExecutionEnvironment();
    const gateway = new McpGateway(permissionPolicy, toolRegistry, executionEnvironment);
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
    const modelFactory = new ModelFactory(undefined, resolveDefaultModelConfig);

    this.initialization = registerExternalToolProviders({
      localEnv: workspaceLocalEnv,
      configuredMcpEndpoints: options.externalMcpEndpoints,
      localEnvLoading,
      toolRegistry,
    });

    this.components = {
      storageRoot,
      storage: this.storage,
      modelFactory,
      agentFactory: new AgentFactory({
        modelFactory,
        gateway,
        toolRegistry,
      }),
      metrics: createMetrics(this.storage),
      checkpoint: createRunCheckpoint(this.storage),
    };
  }
}
