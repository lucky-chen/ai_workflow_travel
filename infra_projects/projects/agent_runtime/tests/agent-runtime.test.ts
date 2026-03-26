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
  await testSessionHandleExecutesAgainstBoundSession();
  await testOpenSessionReturnsExistingSessionHandle();
  await testCloseSessionLifecycleSemantics();
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

async function testSessionHandleExecutesAgainstBoundSession(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });
  const session = await runtime.createSession({
    title: "task-2-session",
  });

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "execute through bound session",
        },
      },
      responseFormat: "json",
    },
  });
  const state = await session.read();

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.[0]?.code, "session_execution_not_implemented");
  assert.equal(state.initialRequest?.payload.responseFormat, "json");
  assert.equal(state.transcript.at(-2)?.role, "user");
  assert.equal(state.transcript.at(-1)?.role, "assistant");
}

async function testOpenSessionReturnsExistingSessionHandle(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });
  const created = await runtime.createSession({
    title: "openable-session",
  });
  const createdState = await created.read();

  const reopened = await runtime.openSession({
    sessionId: createdState.sessionId,
  });
  const reopenedState = await reopened.read();

  assert.equal(reopenedState.sessionId, createdState.sessionId);
  assert.equal(reopenedState.title, "openable-session");
}

async function testCloseSessionLifecycleSemantics(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });
  const session = await runtime.createSession({
    title: "closable-session",
  });
  const state = await session.read();

  assert.equal(await runtime.closeSession(state.sessionId), true);
  assert.equal(await runtime.closeSession(state.sessionId), false);
  assert.equal(await runtime.closeSession("missing-session"), false);

  await assert.rejects(
    () =>
      session.execute({
        payload: {
          prompt: {
            systemPrompt: ["system"],
            userPrompt: {
              task: "should fail",
            },
          },
          responseFormat: "text",
        },
      }),
    /Session is closed/,
  );
}
