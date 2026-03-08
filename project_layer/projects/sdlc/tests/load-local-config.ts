import { readFile } from "node:fs/promises";
import path from "node:path";

export interface LocalConfig {
  llm?: {
    provider?: "openai" | "deepseek";
    api_key?: string;
    base_url?: string;
    model?: string;
  };
}

export async function loadLocalConfig(): Promise<LocalConfig> {
  const configPath = path.resolve(process.cwd(), "local_env.json");

  try {
    const content = await readFile(configPath, "utf8");
    return JSON.parse(content) as LocalConfig;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}
