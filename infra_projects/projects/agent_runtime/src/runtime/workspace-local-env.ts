import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ExternalMcpEndpointConfig } from "../capability/types.js";
import type { RealProviderConfig } from "./types.js";
import type { ModelConfig } from "../model/types.js";

interface WorkspaceLocalEnvConfig {
  llm?: {
    provider?: "openai" | "deepseek";
    api_key?: string;
    base_url?: string;
    model?: string;
    timeout_ms?: number;
  };
  externalMcpEndpoints?: Array<{
    name?: string;
    url?: string;
    headers?: Record<string, string>;
  }>;
}

export interface LoadedWorkspaceLocalEnv {
  config: WorkspaceLocalEnvConfig;
  localEnvPath: string;
}

export class WorkspaceLocalEnv {
  private readonly localEnvPath: string;

  constructor(private readonly workdir: string) {
    this.localEnvPath = path.join(workdir, "sdlc", "local_env.json");
  }

  async load(options: { optional?: boolean } = {}): Promise<LoadedWorkspaceLocalEnv | undefined> {
    let raw: string;

    try {
      raw = await readFile(this.localEnvPath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        if (options.optional) {
          return undefined;
        }
        throw new Error(`Missing local env file: ${this.localEnvPath}`);
      }
      throw error;
    }

    try {
      return {
        config: JSON.parse(raw) as WorkspaceLocalEnvConfig,
        localEnvPath: this.localEnvPath,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid local env JSON: ${this.localEnvPath}. ${message}`);
    }
  }

  getRequiredRealProviderConfig(input: LoadedWorkspaceLocalEnv): RealProviderConfig {
    const llm = input.config.llm;
    if (
      !llm?.provider ||
      !llm.api_key ||
      !llm.model ||
      llm.api_key === "your-api-key"
    ) {
      throw new Error(`Incomplete llm config in ${input.localEnvPath}.`);
    }

    return {
      provider: llm.provider,
      apiKey: llm.api_key,
      baseUrl: llm.base_url,
      model: llm.model,
      timeoutMs: llm.timeout_ms,
    };
  }

  getExternalMcpEndpointConfigs(input?: LoadedWorkspaceLocalEnv): ExternalMcpEndpointConfig[] {
    if (!input) {
      return [];
    }
    const endpoints = input.config.externalMcpEndpoints ?? [];

    return endpoints.map((endpoint, index) => {
      if (!endpoint || typeof endpoint.url !== "string" || endpoint.url.length === 0) {
        throw new Error(`Invalid externalMcpEndpoints[${index}] config in ${input.localEnvPath}.`);
      }
      return {
        name: typeof endpoint.name === "string" ? this.expandWorkdirTemplate(endpoint.name) : undefined,
        url: this.expandWorkdirTemplate(endpoint.url),
        headers: isStringRecord(endpoint.headers)
          ? Object.fromEntries(
            Object.entries(endpoint.headers).map(([key, value]) => [key, this.expandWorkdirTemplate(value)]),
          )
          : undefined,
      };
    });
  }

  private expandWorkdirTemplate(value: string): string {
    return value.replaceAll("${workdir}", this.workdir);
  }
}

export function toRuntimeModelConfig(config: RealProviderConfig): ModelConfig {
  return {
    mock: false,
    modeSelection: {
      provider: config.provider,
      url: config.baseUrl,
      key: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
    },
    mockInfo: config.fetchFn ? { fetchFn: config.fetchFn } : undefined,
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}
