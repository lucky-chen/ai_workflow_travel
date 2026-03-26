import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface LocalEnvOverrides {
  provider?: "openai" | "deepseek";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export async function createTestWorkdir(prefix = "agent-runtime-"): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function writeTestLocalEnv(
  workdir: string,
  overrides: LocalEnvOverrides = {},
): Promise<string> {
  const localEnvPath = path.join(workdir, "sdlc", "local_env.json");
  await mkdir(path.dirname(localEnvPath), { recursive: true });
  await writeFile(
    localEnvPath,
    `${JSON.stringify({
      llm: {
        provider: overrides.provider ?? "openai",
        api_key: overrides.apiKey ?? "test-api-key",
        base_url: overrides.baseUrl ?? "https://api.openai.com/v1",
        model: overrides.model ?? "gpt-4.1-mini",
        timeout_ms: overrides.timeoutMs ?? 30000,
      },
    }, null, 2)}\n`,
    "utf8",
  );
  return localEnvPath;
}
