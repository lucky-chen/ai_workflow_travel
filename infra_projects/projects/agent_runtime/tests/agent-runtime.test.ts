import assert from "node:assert/strict";

import {
  createAgentRuntime,
  type AgentRuntime,
  type AgentSession,
  type AgentSessionState,
} from "../src/runtime/agent-runtime.js";

export async function runAgentRuntimeTests(): Promise<void> {
  await testCreateAgentRuntimeExposesRootApi();
  await testCreateSessionReturnsSessionHandle();
}

async function testCreateAgentRuntimeExposesRootApi(): Promise<void> {
  const runtime: AgentRuntime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });

  assert.equal(typeof runtime.createSession, "function");
  assert.equal(typeof runtime.openSession, "function");
  assert.equal(typeof runtime.closeSession, "function");
}

async function testCreateSessionReturnsSessionHandle(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });

  const session: AgentSession = await runtime.createSession({
    title: "task-1-session",
    initialSystemPrompt: ["system one", "system two"],
    initialUserPrompt: {
      task: "bootstrap",
    },
  });
  const state: AgentSessionState = await session.read();

  assert.equal(typeof session.execute, "function");
  assert.equal(typeof session.read, "function");
  assert.equal(state.title, "task-1-session");
  assert.equal(state.status, "active");
  assert.equal(state.transcript.length, 2);
}
