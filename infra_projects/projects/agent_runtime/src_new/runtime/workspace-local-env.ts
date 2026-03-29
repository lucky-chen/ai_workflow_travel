import { readFile } from "node:fs/promises";
import path from "node:path";

import type { RealProviderConfig, RuntimeModelConfig } from "./types.js";

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
  const localEnvPath = path.join(workdir, "sdlc", "local_env.json");
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

export function toRuntimeModelConfig(config: RealProviderConfig): RuntimeModelConfig {
  return {
    mock: false,
    modeSelection: {
      provider: config.provider,
      url: buildChatCompletionsUrl(config),
      key: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
    },
    mockInfo: config.fetchFn ? { fetchFn: config.fetchFn } : undefined,
  };
}

function buildChatCompletionsUrl(config: RealProviderConfig): string {
  const fallbackBaseUrl = config.provider === "openai"
    ? "https://api.openai.com/v1"
    : "https://api.deepseek.com/v1";
  const baseUrl = (config.baseUrl ?? fallbackBaseUrl).replace(/\/$/, "");
  return `${baseUrl}/chat/completions`;
}
