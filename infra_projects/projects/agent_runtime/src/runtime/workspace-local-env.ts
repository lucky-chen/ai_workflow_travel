import { readFile } from "node:fs/promises";

import type { RealProviderConfig } from "../model/real-provider-config.js";
import { resolveWorkspaceLocalEnvPath } from "./runtime-storage-paths.js";

interface WorkspaceLocalEnvConfig {
  llm?: {
    provider?: "openai" | "deepseek";
    api_key?: string;
    base_url?: string;
    model?: string;
    timeout_ms?: number;
  };
}

export async function loadRequiredRealProviderConfig(workdir: string): Promise<RealProviderConfig> {
  const localEnvPath = resolveWorkspaceLocalEnvPath(workdir);
  let raw: string;

  try {
    raw = await readFile(localEnvPath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      throw new Error(`Missing local env file: ${localEnvPath}`);
    }
    throw error;
  }

  let parsed: WorkspaceLocalEnvConfig;
  try {
    parsed = JSON.parse(raw) as WorkspaceLocalEnvConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid local env JSON: ${localEnvPath}. ${message}`);
  }

  const llm = parsed.llm;
  if (
    !llm?.provider ||
    !llm.api_key ||
    !llm.model ||
    llm.api_key === "your-api-key"
  ) {
    throw new Error(`Incomplete llm config in ${localEnvPath}.`);
  }

  return {
    provider: llm.provider,
    apiKey: llm.api_key,
    baseUrl: llm.base_url,
    model: llm.model,
    timeoutMs: llm.timeout_ms,
  };
}
