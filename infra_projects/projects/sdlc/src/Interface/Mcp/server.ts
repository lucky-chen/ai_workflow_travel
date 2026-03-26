import { randomUUID } from "node:crypto";

import { createApplication, type Application, type ApplicationConfig } from "../../Runtime/application.js";
import { loadWorkspaceRuntimeOptions } from "../CliEntry/workspace-local-env.js";
import { buildMcpRuntimeInput } from "./runtime-request-builder.js";
import { projectRuntimeResultToMcp } from "./result-projection.js";
import { McpProjectRegistryService } from "./project-registry.js";
import { McpToolRegistryService } from "./tool-registry.js";
import type { McpAgentResult, McpToolDefinition, McpToolRequest } from "./types.js";

export interface McpServerApi {
  listTools(): Promise<McpToolDefinition[]>;
  invokeTool(request: McpToolRequest): Promise<McpAgentResult>;
}

export interface McpServerConfig {
  projectRegistry?: McpProjectRegistryService;
  toolRegistry?: McpToolRegistryService;
  applicationFactory?: (workspaceRoot: string) => Promise<Application>;
  runIdFactory?: () => string;
}

export class McpServerService implements McpServerApi {
  private readonly projectRegistry: McpProjectRegistryService;

  private readonly toolRegistry: McpToolRegistryService;

  private readonly applicationFactory: (workspaceRoot: string) => Promise<Application>;

  private readonly runIdFactory: () => string;

  constructor(config: McpServerConfig = {}) {
    this.projectRegistry = config.projectRegistry ?? new McpProjectRegistryService();
    this.toolRegistry = config.toolRegistry ?? new McpToolRegistryService();
    this.applicationFactory = config.applicationFactory ?? createDefaultApplication;
    this.runIdFactory = config.runIdFactory ?? (() => `mcp-${randomUUID()}`);
  }

  async listTools(): Promise<McpToolDefinition[]> {
    return this.toolRegistry.listTools();
  }

  async invokeTool(request: McpToolRequest): Promise<McpAgentResult> {
    const tool = this.toolRegistry.getTool(request.name);
    const args = this.toolRegistry.validateArguments(request.name, request.arguments);
    const project = await this.projectRegistry.resolveProject(args.project_name);
    const runId = this.runIdFactory();
    const application = await this.applicationFactory(project.workspaceRoot);
    const runtimeInput = await buildMcpRuntimeInput(tool, args, project.workspaceRoot, runId);
    const runtimeResult = await application.run(runtimeInput);
    return projectRuntimeResultToMcp({
      tool,
      args,
      runtimeResult,
      workspaceRoot: project.workspaceRoot,
      runId,
    });
  }
}

async function createDefaultApplication(workspaceRoot: string): Promise<Application> {
  const config = await loadWorkspaceRuntimeOptions(workspaceRoot) as ApplicationConfig;
  return createApplication(config);
}
