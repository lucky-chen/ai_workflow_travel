import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getDefaultWorkspaceLocalEnvContent,
  loadWorkspaceLocalEnvConfig,
  resolveConfiguredResourcesRoot,
  resolveWorkspaceLocalEnvPath,
} from "../../src/Interface/CliEntry/workspace-local-env.js";

export async function runWorkspaceLocalEnvTests(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "workspace-local-env-"));

  try {
    await testDefaultContentShape();
    await testMissingLocalEnvFallsBackToDefaultMode(workspaceRoot);
    await testPlaceholderLocalEnvDoesNotEnableRealMode(workspaceRoot);
    await testValidLocalEnvLoadsLlmConfig(workspaceRoot);
    await testConfiguredResourcesRootIsParsed(workspaceRoot);
    await testInvalidJsonThrowsClearError(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testDefaultContentShape(): Promise<void> {
  const parsed = JSON.parse(getDefaultWorkspaceLocalEnvContent()) as {
    resources?: { root_dir?: string };
    llm?: { provider?: string; api_key?: string; model?: string; timeout_ms?: number };
  };
  assert.equal(parsed.resources?.root_dir, "../../meta_layer/resources");
  assert.equal(parsed.llm?.provider, "openai");
  assert.equal(parsed.llm?.api_key, "your-api-key");
  assert.equal(parsed.llm?.model, "gpt-4.1-mini");
  assert.equal(parsed.llm?.timeout_ms, 30000);
}

async function testMissingLocalEnvFallsBackToDefaultMode(workspaceRoot: string): Promise<void> {
  const config = await loadWorkspaceLocalEnvConfig(workspaceRoot);
  assert.deepEqual(config, {});
}

async function testPlaceholderLocalEnvDoesNotEnableRealMode(workspaceRoot: string): Promise<void> {
  const localEnvPath = await ensureWorkspaceLocalEnvPath(workspaceRoot);
  await writeFile(localEnvPath, getDefaultWorkspaceLocalEnvContent(), "utf8");

  const config = await loadWorkspaceLocalEnvConfig(workspaceRoot);
  assert.equal(config.llm?.api_key, "your-api-key");
}

async function testValidLocalEnvLoadsLlmConfig(workspaceRoot: string): Promise<void> {
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
          timeout_ms: 15000,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const config = await loadWorkspaceLocalEnvConfig(workspaceRoot);
  assert.deepEqual(config.llm, {
    provider: "openai",
    api_key: "test-api-key",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    timeout_ms: 15000,
  });
}

async function testConfiguredResourcesRootIsParsed(workspaceRoot: string): Promise<void> {
  const localEnvPath = await ensureWorkspaceLocalEnvPath(workspaceRoot);
  await writeFile(
    localEnvPath,
    JSON.stringify(
      {
        resources: {
          root_dir: "../shared-resources",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const config = await loadWorkspaceLocalEnvConfig(workspaceRoot);
  assert.equal(resolveConfiguredResourcesRoot(workspaceRoot, config), path.resolve(workspaceRoot, "../shared-resources"));
}

async function testInvalidJsonThrowsClearError(workspaceRoot: string): Promise<void> {
  const localEnvPath = await ensureWorkspaceLocalEnvPath(workspaceRoot);
  await writeFile(localEnvPath, "{invalid json", "utf8");

  await assert.rejects(
    async () => loadWorkspaceLocalEnvConfig(workspaceRoot),
    /Invalid workspace local env JSON:/,
  );
}

async function ensureWorkspaceLocalEnvPath(workspaceRoot: string): Promise<string> {
  const localEnvPath = resolveWorkspaceLocalEnvPath(workspaceRoot);
  await mkdir(path.dirname(localEnvPath), { recursive: true });
  return localEnvPath;
}
