import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CompositionRootOptions } from "./composition-root.js";

export interface WorkspaceLocalEnvConfig {
  resources?: {
    root_dir?: string;
  };
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

export function getDefaultWorkspaceLocalEnvContent(): string {
  return `${JSON.stringify(DEFAULT_WORKSPACE_LOCAL_ENV, null, 2)}\n`;
}

export function resolveWorkspaceLocalEnvPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "sdlc", "local_env.json");
}

export async function loadWorkspaceLocalEnvConfig(workspaceRoot?: string): Promise<WorkspaceLocalEnvConfig> {
  if (!workspaceRoot) {
    return {};
  }

  const localEnvPath = resolveWorkspaceLocalEnvPath(workspaceRoot);

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

export function resolveConfiguredResourcesRoot(
  workspaceRoot: string,
  config: WorkspaceLocalEnvConfig,
): string | null {
  const configuredRoot = config.resources?.root_dir?.trim();
  if (!configuredRoot) {
    return null;
  }

  return path.resolve(workspaceRoot, configuredRoot);
}

export async function loadWorkspaceRuntimeOptions(workspaceRoot?: string): Promise<CompositionRootOptions> {
  const parsed = await loadWorkspaceLocalEnvConfig(workspaceRoot);
  const llm = parsed.llm;
  if (!llm?.provider || !llm.api_key || !llm.model || llm.api_key === "your-api-key") {
    return {};
  }

  return {
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
