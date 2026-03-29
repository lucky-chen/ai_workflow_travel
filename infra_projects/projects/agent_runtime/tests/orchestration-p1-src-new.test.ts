import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRuntime, MultiAgentProtocol, RunCheckpoint } from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runOrchestrationP1SrcNewTests(): Promise<void> {
  await testSelectorAndChatExecutionPath();
  await testDynamicModeSelectsReactForThoughtDrivenToolRequests();
  await testReactDoesNotCallToolWithoutThoughtAction();
  await testReactCanContinueToSecondStepBeforeCompletion();
  await testExplicitPeoModeRunsPlanDrivenToolPathWithTrace();
  await testPeoDoesNotCallToolWithoutPlanAction();
  await testPeoCanContinueToSecondStepBeforeCompletion();
  await testPeoToolFailureStillFlowsIntoObserve();
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

async function testReactCanContinueToSecondStepBeforeCompletion(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-loop-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (prompt.stage === "react_thought" && prompt.stepIndex === 1) {
              return JSON.stringify({
                thought: "Inspect first",
                actionType: "respond",
                shouldContinue: true,
              });
            }
            if (prompt.stage === "react_observation" && prompt.stepIndex === 1) {
              return JSON.stringify({
                summary: "Need another react step",
                completed: false,
              });
            }
            if (prompt.stage === "react_thought" && prompt.stepIndex === 2) {
              return JSON.stringify({
                thought: "Finish now",
                actionType: "respond",
                finalAnswer: "react two-step answer",
                shouldContinue: false,
              });
            }
            if (prompt.stage === "react_observation" && prompt.stepIndex === 2) {
              return JSON.stringify({
                summary: "Completed in step 2",
                completed: true,
                finalAnswer: "react two-step answer",
              });
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "need more than one react step",
    },
    mode: "react",
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react two-step answer");
  assert.equal(state.history.at(-1)?.content, "react two-step answer");
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
            peo_plan: JSON.stringify({
              plan: "Use echo to execute plan",
              toolCall: {
                toolName: "echo",
                arguments: {
                  content: "peo tool output",
                },
              },
            }),
            peo_execution: JSON.stringify({
              executionObservation: "peo execution result",
            }),
            peo_observe: "peo observation",
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
  assert.equal(eventTypes.includes("tool_called"), true);
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
            peo_plan: JSON.stringify({
              plan: "Respond directly",
              finalAnswer: "peo direct answer",
            }),
            peo_execution: JSON.stringify({
              executionObservation: "peo direct answer",
              finalAnswer: "peo direct answer",
            }),
            peo_observe: "peo direct answer",
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

async function testPeoCanContinueToSecondStepBeforeCompletion(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-loop-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>, request?: { responseFormat?: string }) => {
            if (prompt.stage === "peo_plan" && prompt.stepIndex === 1) {
              assert.equal(request?.responseFormat, "json");
              assert.deepEqual(prompt.availableTools, ["echo", "read_file", "write_file"]);
              assert.equal(typeof prompt.expectedSchema, "object");
              return JSON.stringify({
                plan: "First step: inspect state",
              });
            }
            if (prompt.stage === "peo_execution" && prompt.stepIndex === 1) {
              assert.equal(typeof prompt.toolResult, "object");
              return JSON.stringify({
                executionObservation: "Executed first step",
              });
            }
            if (prompt.stage === "peo_observe" && prompt.stepIndex === 1) {
              assert.equal(typeof prompt.executionResult, "object");
              return JSON.stringify({
                summary: "Need another step",
                completed: false,
              });
            }
            if (prompt.stage === "peo_plan" && prompt.stepIndex === 2) {
              return JSON.stringify({
                plan: "Second step: finish response",
                finalAnswer: "peo two-step answer",
              });
            }
            if (prompt.stage === "peo_execution" && prompt.stepIndex === 2) {
              return JSON.stringify({
                executionObservation: "Executed second step",
                finalAnswer: "peo two-step answer",
              });
            }
            if (prompt.stage === "peo_observe" && prompt.stepIndex === 2) {
              assert.equal(typeof prompt.executionResult, "object");
              return JSON.stringify({
                summary: "Completed in step 2",
                completed: true,
                finalAnswer: "peo two-step answer",
              });
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "need more than one peo step",
    },
    mode: "peo",
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "peo two-step answer");
  assert.equal(state.history.at(-1)?.content, "peo two-step answer");
  assert.equal(state.history.filter((item) => item.role === "assistant").length >= 1, true);
}

async function testPeoToolFailureStillFlowsIntoObserve(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-tool-failure-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (prompt.stage === "peo_plan") {
              return JSON.stringify({
                plan: "Try a missing tool then observe the failure",
                toolCall: {
                  toolName: "missing_tool",
                  arguments: {},
                },
              });
            }
            if (prompt.stage === "peo_execution") {
              assert.equal(typeof prompt.toolResult, "object");
              return JSON.stringify({
                executionObservation: "Tool failed during execution",
              });
            }
            if (prompt.stage === "peo_observe") {
              assert.equal(typeof prompt.executionResult, "object");
              return JSON.stringify({
                summary: "Observed missing tool failure",
                completed: true,
                finalAnswer: "peo handled tool failure",
              });
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "fail tool and continue",
    },
    mode: "peo",
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "peo handled tool failure");
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
