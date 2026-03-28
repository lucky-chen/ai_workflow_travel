import assert from "node:assert/strict";

import { createRuntime, ReservedMultiAgentProtocol, ReservedRunCheckpoint } from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runOrchestrationP1SrcNewTests(): Promise<void> {
  await testSelectorAndChatExecutionPath();
  await testDynamicModeSelectsReactForToolRequests();
  await testExplicitPeoModeRunsPeoPath();
  await testReservedPlaceholdersStayCallable();
}

async function testSelectorAndChatExecutionPath(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-chat-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "chat result",
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "say hello",
    },
    mode: "chat",
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "chat result");
  assert.equal(state.history.at(-1)?.role, "assistant");
}

async function testDynamicModeSelectsReactForToolRequests(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "react result",
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "use tool",
      toolName: "echo",
      toolPayload: {
        content: "tool output",
      },
      workingDirectory: workdir,
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react result");
  assert.equal(state.history.some((item) => item.role === "tool"), true);
}

async function testExplicitPeoModeRunsPeoPath(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "peo observation",
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "plan execute observe",
    },
    mode: "peo",
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "peo observation");
}

async function testReservedPlaceholdersStayCallable(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-placeholder-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({});
  const loaded = await session.load();
  const protocol = new ReservedMultiAgentProtocol();
  const checkpoint = new ReservedRunCheckpoint({
    async load() {
      return {};
    },
    async save() {},
  });

  const delegation = await protocol.delegate({
    task: {
      sessionId: loaded.sessionId,
    },
  });
  const captured = await checkpoint.capture({
    sessionId: loaded.sessionId,
    runId: "run-1",
    stepIndex: 1,
    recoveryMetadata: {
      resumeToken: "token-1",
      capturedAt: new Date().toISOString(),
    },
  });

  assert.equal(delegation.result.enabled, false);
  assert.equal(captured.sessionId, loaded.sessionId);
}
