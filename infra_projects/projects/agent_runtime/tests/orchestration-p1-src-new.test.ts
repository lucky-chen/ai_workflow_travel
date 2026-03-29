import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRuntime, MultiAgentProtocol, RunCheckpoint } from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runOrchestrationP1SrcNewTests(): Promise<void> {
  await testSelectorAndChatExecutionPath();
  await testDynamicModeSelectsReactForThoughtDrivenToolRequests();
  await testReactDoesNotCallToolWithoutThoughtAction();
  await testExplicitPeoModeRunsPlanDrivenToolPathWithTrace();
  await testPeoDoesNotCallToolWithoutPlanAction();
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

async function testDynamicModeSelectsReactForThoughtDrivenToolRequests(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: () => JSON.stringify({
            thought: "Use echo tool",
            actionType: "tool",
            toolName: "echo",
            actionPayload: {
              content: "tool output",
            },
            finalAnswer: "react result",
            shouldContinue: true,
          }),
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "use tool",
      workingDirectory: workdir,
    },
    metadata: {
      useTools: true,
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react result");
  assert.equal(state.history.some((item) => item.role === "tool"), true);
}

async function testReactDoesNotCallToolWithoutThoughtAction(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-no-tool-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: () => JSON.stringify({
            thought: "Answer directly",
            actionType: "respond",
            finalAnswer: "react direct answer",
            shouldContinue: false,
          }),
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "do not use tool",
      toolName: "echo",
      toolPayload: {
        content: "should not run",
      },
      workingDirectory: workdir,
    },
    mode: "react",
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react direct answer");
  assert.equal(state.history.some((item) => item.role === "tool"), false);
}

async function testExplicitPeoModeRunsPlanDrivenToolPathWithTrace(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          responses: {
            plan: JSON.stringify({
              plan: "Use echo to execute plan",
              executionType: "tool",
              toolName: "echo",
              executionPayload: {
                content: "peo tool output",
              },
            }),
            observe: "peo observation",
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "plan execute observe",
      workingDirectory: workdir,
    },
    mode: "peo",
  });
  const state = await session.load();
  const tracePayload = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "trace", "events.json"), "utf8"),
  ) as { events?: Array<{ eventType?: string }> };
  const eventTypes = (tracePayload.events ?? []).map((event) => event.eventType);

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "peo observation");
  assert.equal(state.history.some((item) => item.role === "tool"), true);
  assert.equal(eventTypes.includes("model_called"), true);
  assert.equal(eventTypes.includes("model_result_recorded"), true);
  assert.equal(eventTypes.includes("tool_called"), true);
  assert.equal(eventTypes.includes("tool_result_recorded"), true);
}

async function testPeoDoesNotCallToolWithoutPlanAction(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-no-tool-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          responses: {
            plan: JSON.stringify({
              plan: "Respond directly",
              executionType: "respond",
            }),
            observe: "peo direct answer",
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "respond directly",
      toolName: "echo",
      toolPayload: {
        content: "should not run",
      },
      workingDirectory: workdir,
    },
    mode: "peo",
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "peo direct answer");
  assert.equal(state.history.some((item) => item.role === "tool"), false);
}

async function testReservedPlaceholdersStayCallable(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-placeholder-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({});
  const loaded = await session.load();
  const protocol = new MultiAgentProtocol();
  const checkpoint = new RunCheckpoint({
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
  assert.equal(captured.recoveryMetadata.enabled, false);
}
