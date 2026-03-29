import assert from "node:assert/strict";

import { runTerminalSessionCli } from "../bin/terminal-session-demo.js";
import {
  createRuntime,
  loadRequiredRealProviderConfig,
  type FetchLike,
} from "../src_new/index.js";
import { createTestWorkdir, writeTestLocalEnv } from "./test-workdir.js";

export async function runRealProviderP1SrcNewTests(): Promise<void> {
  await testLoadRequiredRealProviderConfig();
  await testLoadRequiredRealProviderConfigFailsWhenMissing();
  await testRuntimeUsesRealProviderModeFromLocalEnv();
  await testTerminalCliUsesRealProviderRuntimePath();
}

async function testLoadRequiredRealProviderConfig(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-load-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    apiKey: "deepseek-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    timeoutMs: 10000,
  });

  const config = await loadRequiredRealProviderConfig(workdir);
  assert.equal(config.provider, "deepseek");
  assert.equal(config.apiKey, "deepseek-key");
  assert.equal(config.baseUrl, "https://api.deepseek.com");
  assert.equal(config.model, "deepseek-chat");
}

async function testLoadRequiredRealProviderConfigFailsWhenMissing(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-missing-");
  await assert.rejects(
    () => loadRequiredRealProviderConfig(workdir),
    /Missing local env file/,
  );
}

async function testRuntimeUsesRealProviderModeFromLocalEnv(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-runtime-");
  await writeTestLocalEnv(workdir, {
    provider: "openai",
    apiKey: "openai-key",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    timeoutMs: 10000,
  });
  const fetchFn: FetchLike = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        choices: [
          {
            message: {
              content: "real provider result",
            },
          },
        ],
      });
    },
  });

  const runtime = createRuntime({
    workdir,
    defaultModelMode: "real_from_local_env",
    realProviderFetchFn: fetchFn,
  });
  const session = await runtime.createSession({});
  const result = await session.execute({
    content: {
      task: "use real provider",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "real provider result");
}

async function testTerminalCliUsesRealProviderRuntimePath(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-real-provider-cli-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    apiKey: "deepseek-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    timeoutMs: 10000,
  });
  const fetchFn: FetchLike = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        choices: [
          {
            message: {
              content: "cli real provider result",
            },
          },
        ],
      });
    },
  });
  const lines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => {
      const next = lines.some((line) => line.includes("cli real provider result")) ? "exit" : "hello";
      return next;
    },
    writeLine: async (line) => {
      lines.push(line);
    },
    writeError: async () => {},
    createRuntime: ({ workdir: runtimeWorkdir }) => createRuntime({
      workdir: runtimeWorkdir,
      defaultModelMode: "real_from_local_env",
      realProviderFetchFn: fetchFn,
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(lines.some((line) => line.includes("cli real provider result")), true);
}
