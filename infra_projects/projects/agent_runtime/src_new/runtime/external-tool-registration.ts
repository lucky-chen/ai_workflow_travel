import type { LoadedWorkspaceLocalEnv } from "./workspace-local-env.js";
import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import { registerExternalMcpEndpoints } from "../capability/external_mcp_tool_adapter.js";
import type { McpToolRegistry } from "../capability/types.js";
import type { Trace } from "../observability/trace.js";
import { WorkspaceLocalEnv } from "./workspace-local-env.js";

export async function registerExternalToolProviders(input: {
  localEnv: WorkspaceLocalEnv;
  configuredMcpEndpoints?: ExternalMcpEndpointConfig[];
  localEnvLoading?: Promise<LoadedWorkspaceLocalEnv | undefined>;
  toolRegistry: McpToolRegistry;
  trace: Trace;
}): Promise<void> {
  const loaded = input.configuredMcpEndpoints
    ? undefined
    : await (input.localEnvLoading ?? input.localEnv.load({ optional: true }));
  const endpoints = input.configuredMcpEndpoints ?? input.localEnv.getExternalMcpEndpointConfigs(loaded);
  await registerExternalMcpEndpoints(input.toolRegistry, endpoints, input.trace);
}
