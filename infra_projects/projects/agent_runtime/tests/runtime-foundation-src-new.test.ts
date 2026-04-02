import assert from "node:assert/strict";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createRuntime, type SessionApi, type SessionEvent, type SessionEventListener } from "../src/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runRuntimeFoundationSrcNewTests(): Promise<void> {
  await testRuntimeExposesStableApi();
  await testCreateSessionReturnsStableSessionHandle();
  await testRuntimeSubscriptionReceivesSessionLifecycleEvents();
  await testRuntimeSubscriptionReceivesSessionRunEvents();
  await testRuntimeSubscriptionDeduplicatesAndUnsubscribes();
  await testRuntimeSubscriptionSelfUnsubscribeDoesNotBreakPublish();
  await testOpenSessionReloadsPersistedSession();
  await testCloseSessionPersistsClosedState();
  await testOpenSessionReactivatesClosedSession();
  await testCloseSessionDoesNotEmitOpenEvents();
  await testOpenSessionSynchronizesTranscriptHistory();
}

async function testRuntimeSubscriptionReceivesSessionLifecycleEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-subscribe-lifecycle-");
  const received: string[] = [];
  const runtime = createRuntime({ workdir });
  const listener: SessionEventListener = {
    onEvent(event) {
      received.push(event.brief);
    },
  };
  runtime.subscribeEvents(listener);

  const session = await runtime.createSession({});
  const state = await session.load();
  await runtime.closeSession(state.sessionId);
  runtime.unsubscribeEvents(listener);

  assert.equal(received.includes("session_create_requested"), true);
  assert.equal(received.includes("session_created"), true);
  assert.equal(received.includes("session_closed"), true);
}

async function testRuntimeSubscriptionReceivesSessionRunEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-subscribe-run-events-");
  const received: string[] = [];
  const runtime = createRuntime({ workdir });
  const listener: SessionEventListener = {
    onEvent(event) {
      received.push(event.brief);
    },
  };
  runtime.subscribeEvents(listener);
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "chat callback answer",
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "what is callback result",
    },
  });
  runtime.unsubscribeEvents(listener);

  assert.equal(result.errorCode, undefined);
  assert.equal(received.includes("run_started"), true);
  assert.equal(received.includes("context_assembled"), true);
  assert.equal(received.includes("state_persisted"), true);
  assert.equal(received.includes("run_finished"), true);
}

async function testRuntimeSubscriptionDeduplicatesAndUnsubscribes(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-subscribe-dedup-");
  const received: SessionEvent[] = [];
  const runtime = createRuntime({ workdir });
  const listener: SessionEventListener = {
    onEvent(event) {
      received.push(event);
    },
  };
  runtime.subscribeEvents(listener);
  runtime.subscribeEvents(listener);
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "chat answer",
        },
      },
    },
  });
  await session.execute({
    content: {
      task: "what is dedup result",
    },
  });
  const countBeforeUnsubscribe = received.length;
  runtime.unsubscribeEvents(listener);
  runtime.unsubscribeEvents(listener);
  await session.execute({
    content: {
      task: "what is after unsubscribe",
    },
  });

  assert.equal(countBeforeUnsubscribe > 0, true);
  assert.equal(received.length, countBeforeUnsubscribe);
}

async function testRuntimeSubscriptionSelfUnsubscribeDoesNotBreakPublish(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-subscribe-self-remove-");
  const runtime = createRuntime({ workdir });
  const received: string[] = [];
  const persistentListener: SessionEventListener = {
    onEvent(event) {
      received.push(event.brief);
    },
  };
  const selfRemovingListener: SessionEventListener = {
    onEvent() {
      runtime.unsubscribeEvents(selfRemovingListener);
    },
  };
  runtime.subscribeEvents(selfRemovingListener);
  runtime.subscribeEvents(persistentListener);

  const session = await runtime.createSession({});
  const state = await session.load();
  await runtime.closeSession(state.sessionId);

  assert.equal(received.includes("session_create_requested"), true);
  assert.equal(received.includes("session_closed"), true);
}

async function testRuntimeExposesStableApi(): Promise<void> {
  const runtime: SessionApi = createRuntime({
    workdir: await createTestWorkdir("agent-runtime-src-new-api-"),
  });

  assert.equal(typeof runtime.createSession, "function");
  assert.equal(typeof runtime.openSession, "function");
  assert.equal(typeof runtime.closeSession, "function");
  assert.equal(typeof runtime.subscribeEvents, "function");
  assert.equal(typeof runtime.unsubscribeEvents, "function");
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

async function testOpenSessionReactivatesClosedSession(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-reopen-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "reopened response",
        },
      },
    },
  });
  const state = await session.load();

  await runtime.closeSession(state.sessionId);

  const reopened = await runtime.openSession(state.sessionId);
  const reopenedState = await reopened.load();
  const result = await reopened.execute({
    content: {
      task: "what is continue session",
    },
  });

  assert.equal(reopenedState.sessionId, state.sessionId);
  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "reopened response");

  const persistedPath = path.join(workdir, ".agent_runtime", "sessions", `${state.sessionId}.json`);
  const persistedRaw = await readFile(persistedPath, "utf8");
  const persisted = JSON.parse(persistedRaw) as { status?: string };

  assert.equal(persisted.status, "active");
}

async function testCloseSessionDoesNotEmitOpenEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-close-trace-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({});
  const state = await session.load();

  await runtime.closeSession(state.sessionId);
  await runtime.closeSession(state.sessionId);

  const tracePath = await findOnlyTraceFile(workdir);
  const tracePayload = JSON.parse(await readFile(tracePath, "utf8")) as {
    events?: Array<{ brief?: string; details?: Record<string, unknown> }>;
  };
  const sessionEvents = (tracePayload.events ?? []).filter((event) => event.details?.sessionId === state.sessionId);

  assert.equal(sessionEvents.some((event) => event.brief === "session_opened"), false);
  assert.equal(sessionEvents.filter((event) => event.brief === "session_closed").length, 2);
}

async function testOpenSessionSynchronizesTranscriptHistory(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-sync-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    sysPrompt: ["system prompt"],
  });
  const state = await session.load();
  const sessionPath = path.join(workdir, ".agent_runtime", "sessions", `${state.sessionId}.json`);

  const persistedRaw = await readFile(sessionPath, "utf8");
  const persisted = JSON.parse(persistedRaw) as { history?: Array<{ role: string; content: string }> };
  persisted.history = [{ role: "user", content: "mismatched-history" }];
  await writeFile(sessionPath, JSON.stringify(persisted, null, 2), "utf8");

  const reopened = await createRuntime({ workdir }).openSession(state.sessionId);
  const reopenedState = await reopened.load();

  assert.equal(reopenedState.history[0]?.content, "system prompt");
}

async function findOnlyTraceFile(workdir: string): Promise<string> {
  const traceDir = path.join(workdir, ".agent_runtime", "traces");
  const entries = await readdir(traceDir);
  assert.equal(entries.length, 1);
  return path.join(traceDir, entries[0]!);
}
