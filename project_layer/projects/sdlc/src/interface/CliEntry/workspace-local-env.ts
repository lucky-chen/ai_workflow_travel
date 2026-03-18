import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ApplicationConfig } from "../../Runtime/application.js";

export interface WorkspaceResourcesConfig {
  root_dir?: string;
}

export interface WorkspaceLocalEnvConfig {
  resources?: WorkspaceResourcesConfig;
  llm?: {
    provider?: "openai" | "deepseek";
    api_key?: string;
    base_url?: string;
    model?: string;
    timeout_ms?: number;
  };
}

const DEFAULT_WORKSPACE_LOCAL_ENV: WorkspaceLocalEnvConfig = {
  resources: {
    root_dir: "../../meta_layer/resources",
  },
  llm: {
    provider: "openai",
    api_key: "your-api-key",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    timeout_ms: 30000,
  },
};

export class WorkspaceLocalEnvService {
  getDefaultContent(): string {
    return `${JSON.stringify(DEFAULT_WORKSPACE_LOCAL_ENV, null, 2)}\n`;
  }

  resolveLocalEnvPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, "sdlc", "local_env.json");
  }

  async loadConfig(workspaceRoot?: string): Promise<WorkspaceLocalEnvConfig> {
    if (!workspaceRoot) {
      return {};
    }

    const localEnvPath = this.resolveLocalEnvPath(workspaceRoot);

    let raw: string;
    try {
      raw = await readFile(localEnvPath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return {};
      }

      throw error;
    }

    let parsed: WorkspaceLocalEnvConfig;
    try {
      parsed = JSON.parse(raw) as WorkspaceLocalEnvConfig;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid workspace local env JSON: ${localEnvPath}. ${message}`);
    }

    return parsed;
  }

  async loadApplicationConfig(workspaceRoot?: string): Promise<ApplicationConfig> {
    const parsed = await this.loadConfig(workspaceRoot);
    const llm = parsed.llm;
    const resourceRoot = this.resolveResourceRoot(parsed, workspaceRoot);
    if (!llm?.provider || !llm.api_key || !llm.model || llm.api_key === "your-api-key") {
      return resourceRoot ? { resourceRoot } : {};
    }

    return {
      ...(resourceRoot ? { resourceRoot } : {}),
      llmExecutor: {
        mode: "real",
        realProvider: {
          provider: llm.provider,
          apiKey: llm.api_key,
          baseUrl: llm.base_url,
          model: llm.model,
          timeoutMs: llm.timeout_ms,
        },
      },
    };
  }

  private resolveResourceRoot(config: WorkspaceLocalEnvConfig, workspaceRoot?: string): string | undefined {
    const rootDir = config.resources?.root_dir?.trim();
    if (!rootDir) {
      return undefined;
    }

    if (!workspaceRoot || path.isAbsolute(rootDir)) {
      return rootDir;
    }

    return path.resolve(workspaceRoot, rootDir);
  }
}

const defaultWorkspaceLocalEnvService = new WorkspaceLocalEnvService();

export function getDefaultWorkspaceLocalEnvContent(): string {
  return defaultWorkspaceLocalEnvService.getDefaultContent();
}

export function resolveWorkspaceLocalEnvPath(workspaceRoot: string): string {
  return defaultWorkspaceLocalEnvService.resolveLocalEnvPath(workspaceRoot);
}

export async function loadWorkspaceLocalEnvConfig(workspaceRoot?: string): Promise<WorkspaceLocalEnvConfig> {
  return defaultWorkspaceLocalEnvService.loadConfig(workspaceRoot);
}

export async function loadWorkspaceRuntimeOptions(workspaceRoot?: string): Promise<ApplicationConfig> {
  return defaultWorkspaceLocalEnvService.loadApplicationConfig(workspaceRoot);
}
