import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getDefaultWorkspaceLocalEnvContent,
  loadWorkspaceRuntimeOptions,
  resolveWorkspaceLocalEnvPath,
} from "../../src/app/workspace-local-env.js";

export async function runWorkspaceLocalEnvTests(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "workspace-local-env-"));

  try {
    await testDefaultContentShape();
    await testMissingLocalEnvFallsBackToDefaultMode(workspaceRoot);
    await testPlaceholderLocalEnvDoesNotEnableRealMode(workspaceRoot);
    await testValidLocalEnvEnablesRealMode(workspaceRoot);
    await testInvalidJsonThrowsClearError(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testDefaultContentShape(): Promise<void> {
  const parsed = JSON.parse(getDefaultWorkspaceLocalEnvContent()) as {
    llm?: { provider?: string; api_key?: string; model?: string };
  };
  assert.equal(parsed.llm?.provider, "openai");
  assert.equal(parsed.llm?.api_key, "your-api-key");
  assert.equal(parsed.llm?.model, "gpt-4.1-mini");
}

async function testMissingLocalEnvFallsBackToDefaultMode(workspaceRoot: string): Promise<void> {
  const options = await loadWorkspaceRuntimeOptions(workspaceRoot);
  assert.deepEqual(options, {});
}

async function testPlaceholderLocalEnvDoesNotEnableRealMode(workspaceRoot: string): Promise<void> {
  const localEnvPath = await ensureWorkspaceLocalEnvPath(workspaceRoot);
  await writeFile(localEnvPath, getDefaultWorkspaceLocalEnvContent(), "utf8");

  const options = await loadWorkspaceRuntimeOptions(workspaceRoot);
  assert.deepEqual(options, {});
}

async function testValidLocalEnvEnablesRealMode(workspaceRoot: string): Promise<void> {
  const localEnvPath = await ensureWorkspaceLocalEnvPath(workspaceRoot);
  await writeFile(
    localEnvPath,
    JSON.stringify(
      {
        llm: {
          provider: "openai",
          api_key: "test-api-key",
          base_url: "https://api.openai.com/v1",
          model: "gpt-4.1-mini",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const options = await loadWorkspaceRuntimeOptions(workspaceRoot);
  assert.deepEqual(options, {
    llmExecutor: {
      mode: "real",
      realProvider: {
        provider: "openai",
        apiKey: "test-api-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
      },
    },
  });
}

async function testInvalidJsonThrowsClearError(workspaceRoot: string): Promise<void> {
  const localEnvPath = await ensureWorkspaceLocalEnvPath(workspaceRoot);
  await writeFile(localEnvPath, "{invalid json", "utf8");

  await assert.rejects(
    async () => loadWorkspaceRuntimeOptions(workspaceRoot),
    /Invalid workspace local env JSON:/,
  );
}

async function ensureWorkspaceLocalEnvPath(workspaceRoot: string): Promise<string> {
  const localEnvPath = resolveWorkspaceLocalEnvPath(workspaceRoot);
  await mkdir(path.dirname(localEnvPath), { recursive: true });
  return localEnvPath;
}
