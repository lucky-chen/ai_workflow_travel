import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { createRuntime, type RuntimeApi } from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runRuntimeFoundationSrcNewTests(): Promise<void> {
  await testRuntimeExposesStableApi();
  await testCreateSessionReturnsStableSessionHandle();
  await testOpenSessionReloadsPersistedSession();
  await testCloseSessionPersistsClosedState();
}

async function testRuntimeExposesStableApi(): Promise<void> {
  const runtime: RuntimeApi = createRuntime({
    workdir: await createTestWorkdir("agent-runtime-src-new-api-"),
  });

  assert.equal(typeof runtime.createSession, "function");
  assert.equal(typeof runtime.openSession, "function");
  assert.equal(typeof runtime.closeSession, "function");
}

async function testCreateSessionReturnsStableSessionHandle(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-create-");
  const runtime = createRuntime({ workdir });

  const session = await runtime.createSession({
    title: "foundation",
    sysPrompt: ["system-a"],
    userPrompt: { task: "bootstrap" },
  });
  const state = await session.load();

  assert.equal(typeof session.execute, "function");
  assert.equal(typeof session.isRunning, "function");
  assert.equal(state.history.length, 2);
  assert.equal(state.history[0]?.role, "system");
  assert.equal(state.history[1]?.role, "user");
}

async function testOpenSessionReloadsPersistedSession(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-open-");
  const runtime = createRuntime({ workdir });
  const created = await runtime.createSession({
    title: "reopenable",
  });
  const createdState = await created.load();

  const reopenedRuntime = createRuntime({ workdir });
  const reopened = await reopenedRuntime.openSession(createdState.sessionId);
  const reopenedState = await reopened.load();

  assert.equal(reopenedState.sessionId, createdState.sessionId);
  assert.deepEqual(reopenedState.history, createdState.history);

  const persistedPath = path.join(workdir, ".agent_runtime", "sessions", `${createdState.sessionId}.json`);
  await access(persistedPath);
}

async function testCloseSessionPersistsClosedState(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-close-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({});
  const state = await session.load();

  const result = await runtime.closeSession(state.sessionId);
  assert.equal(result.sessionId, state.sessionId);

  const persistedPath = path.join(workdir, ".agent_runtime", "sessions", `${state.sessionId}.json`);
  const persistedRaw = await readFile(persistedPath, "utf8");
  const persisted = JSON.parse(persistedRaw) as { status?: string };

  assert.equal(persisted.status, "closed");
}
