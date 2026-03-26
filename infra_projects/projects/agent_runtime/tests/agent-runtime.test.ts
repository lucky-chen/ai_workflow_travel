import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createAgentRuntime,
  type AgentRuntime,
  type AgentSession,
  type AgentSessionState,
} from "../src/runtime/agent-runtime.js";
import type { FetchLike } from "../src/model/http-json-client.js";
import { resolveMemoryPath, resolveSessionStatePath, resolveSessionTranscriptPath } from "../src/runtime/runtime-storage-paths.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runAgentRuntimeTests(): Promise<void> {
  await testCreateAgentRuntimeExposesRootApi();
  await testCreateSessionReturnsSessionHandle();
  await testSessionHandleExecutesAgainstBoundSession();
  await testOpenSessionReturnsExistingSessionHandle();
  await testCloseSessionLifecycleSemantics();
  await testCloseSessionReturnsUsageSummary();
  await testRuntimePersistsSessionStateAndTranscript();
  await testRuntimeMarksSessionFailedWhenExecutionFails();
  await testRuntimeWritesToolTurnsAndMemorySummary();
  await testCloseSessionPersistsClosedMemorySummary();
  await testCloseSessionDoesNotReuseStaleMemoryScope();
  await testRuntimeWritesAllTraceEventsIntoSingleRuntimeTraceFile();
  await testRuntimeUsesRealBackendForPlanningRequestContract();
  await testRuntimeUsesRealBackendWhenConfigured();
  await testRuntimeUsesRealBackendForChatJsonPath();
  await testRuntimeUsesRealBackendForTaskJsonPath();
  await testRuntimeCategorizesRealProviderEmptyResponse();
  await testRuntimeCategorizesRealProviderMalformedOutput();
}

async function testCreateAgentRuntimeExposesRootApi(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime: AgentRuntime = createAgentRuntime({
    workdir,
  });

  assert.equal(typeof runtime.createSession, "function");
  assert.equal(typeof runtime.openSession, "function");
  assert.equal(typeof runtime.closeSession, "function");
}

async function testCreateSessionReturnsSessionHandle(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
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
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
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

  assert.equal(result.status, "success");
  assert.equal(result.payload.responseFormat, "json");
  assert.equal(state.initialRequest?.payload.responseFormat, "json");
  assert.equal(state.status, "completed");
  assert.equal(state.transcript.at(-2)?.role, "user");
  assert.equal(state.transcript.at(-1)?.role, "assistant");
}

async function testOpenSessionReturnsExistingSessionHandle(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
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
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
  });
  const session = await runtime.createSession({
    title: "closable-session",
  });
  const state = await session.read();

  assert.equal((await runtime.closeSession(state.sessionId)).closed, true);
  assert.equal((await runtime.closeSession(state.sessionId)).closed, false);
  assert.equal((await runtime.closeSession("missing-session")).closed, false);

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

async function testCloseSessionReturnsUsageSummary(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-test",
      fetchFn: async (_url, init) => {
        const body = String(init.body ?? "");
        const responseBody = body.includes("planning component inside AgentRuntime")
          ? {
              usage: {
                prompt_tokens: 11,
                completion_tokens: 7,
                total_tokens: 18,
              },
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: JSON.stringify({
                      intent: "chat",
                      mode: "direct_generation",
                      summary: "close usage plan",
                      stepIndex: 1,
                      nextStepGoal: "answer",
                      completed: true,
                      stopReason: "completed",
                    }),
                  },
                },
              ],
            }
          : {
              usage: {
                prompt_tokens: 13,
                completion_tokens: 5,
                total_tokens: 18,
              },
              choices: [
                {
                  finish_reason: "stop",
                  message: {
                    content: "{\"answer\":\"usage result\"}",
                  },
                },
              ],
            };

        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify(responseBody);
          },
          async json() {
            return responseBody;
          },
        };
      },
    },
  });
  const session = await runtime.createSession({});
  const state = await session.read();

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: {
          task: "close usage summary",
        },
      },
      responseFormat: "json",
    },
  });

  const closeResult = await runtime.closeSession(state.sessionId);
  const persistedState = JSON.parse(
    await readFile(resolveSessionStatePath(workdir, state.sessionId), "utf8"),
  ) as { usageSummary?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };

  assert.equal(closeResult.closed, true);
  assert.deepEqual(closeResult.usageSummary, {
    inputTokens: 24,
    outputTokens: 12,
    totalTokens: 36,
  });
  assert.deepEqual(persistedState.usageSummary, closeResult.usageSummary);
}

async function testRuntimePersistsSessionStateAndTranscript(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({ workdir });
  const session = await runtime.createSession({ title: "persisted-session" });
  const state = await session.read();

  const stateFile = resolveSessionStatePath(workdir, state.sessionId);
  const transcriptFile = resolveSessionTranscriptPath(workdir, state.sessionId);

  const persistedState = JSON.parse(await readFile(stateFile, "utf8")) as { title?: string; status?: string };
  const persistedTranscript = JSON.parse(await readFile(transcriptFile, "utf8")) as Array<{ role: string }>;

  assert.equal(persistedState.title, "persisted-session");
  assert.equal(persistedState.status, "active");
  assert.equal(Array.isArray(persistedTranscript), true);
}

async function testRuntimeMarksSessionFailedWhenExecutionFails(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mockExecute(request) {
      if (request.mode === "planning") {
        return {
          content: JSON.stringify({
            intent: "task",
            mode: "direct_generation",
            summary: "plan",
            stepIndex: 1,
            nextStepGoal: "execute",
          }),
          responseFormat: "json",
        };
      }
      return {
        content: "not-json",
        responseFormat: "json",
      };
    },
  });
  const session = await runtime.createSession({});

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "fail" },
      },
      responseFormat: "json",
    },
  });
  const state = await session.read();

  assert.equal(result.status, "failed");
  assert.equal(state.status, "failed");
}

async function testRuntimeWritesToolTurnsAndMemorySummary(): Promise<void> {
  const workdir = await createTestWorkdir();
  const readableFile = path.join(workdir, "README.md");
  await writeFile(readableFile, "# agent runtime\n", "utf8");
  const runtime = createAgentRuntime({
    workdir,
    mockExecute(request) {
      if (request.mode === "planning") {
        const stepIndex = Number(request.prompt.userPrompt.stepIndex ?? 1);
        if (stepIndex === 1) {
          return {
            content: JSON.stringify({
              intent: "task",
              mode: "tool_augmented_generation",
              summary: "use tool",
              stepIndex,
              nextStepGoal: "execute with tool",
              completed: false,
              toolSteps: [
                {
                  toolName: "file_read",
                  arguments: { path: readableFile },
                },
              ],
            }),
            responseFormat: "json",
          };
        }
        return {
          content: JSON.stringify({
            intent: "chat",
            mode: "direct_generation",
            summary: "finish",
            stepIndex,
            nextStepGoal: "finalize result",
            completed: true,
            stopReason: "completed",
          }),
          responseFormat: "json",
        };
      }
      if (request.prompt.userPrompt.intent === "chat") {
        return {
          content: JSON.stringify({
            answer: "tool-backed result",
          }),
          responseFormat: "json",
        };
      }
      return {
        content: JSON.stringify({
          summary: "tool-backed result",
        }),
        responseFormat: "json",
      };
    },
  });
  const session = await runtime.createSession({});

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "tool transcript" },
      },
      responseFormat: "json",
      memoryScope: "scope-tool",
    },
  });
  const state = await session.read();
  const memory = JSON.parse(await readFile(resolveMemoryPath(workdir, "scope-tool"), "utf8")) as Array<{ key: string }>;

  assert.equal(state.transcript.some((turn) => turn.role === "tool"), true);
  assert.equal(memory.some((entry) => entry.key === "result_summary"), true);
}

async function testCloseSessionPersistsClosedMemorySummary(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mockExecute(request) {
      if (request.mode === "planning") {
        return {
          content: JSON.stringify({
            intent: "chat",
            mode: "direct_generation",
            summary: "finish",
            stepIndex: 1,
            nextStepGoal: "finalize",
            completed: true,
            stopReason: "completed",
          }),
          responseFormat: "json",
        };
      }

      return {
        content: JSON.stringify({
          answer: "summary target",
        }),
        responseFormat: "json",
      };
    },
  });
  const session = await runtime.createSession({});
  const state = await session.read();

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "close summary" },
      },
      responseFormat: "json",
      memoryScope: "close-scope",
    },
  });
  await runtime.closeSession(state.sessionId);

  const persistedState = JSON.parse(
    await readFile(resolveSessionStatePath(workdir, state.sessionId), "utf8"),
  ) as { status?: string; closedMemorySummary?: Array<{ key?: string }> };

  assert.equal(persistedState.status, "closed");
  assert.equal(Array.isArray(persistedState.closedMemorySummary), true);
  assert.equal(persistedState.closedMemorySummary?.some((entry) => entry.key === "result_summary"), true);
}

async function testCloseSessionDoesNotReuseStaleMemoryScope(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mockExecute(request) {
      if (request.mode === "planning") {
        return {
          content: JSON.stringify({
            intent: "chat",
            mode: "direct_generation",
            summary: "finish",
            stepIndex: 1,
            nextStepGoal: "finalize",
            completed: true,
            stopReason: "completed",
          }),
          responseFormat: "json",
        };
      }

      return {
        content: JSON.stringify({
          answer: "ok",
        }),
        responseFormat: "json",
      };
    },
  });
  const session = await runtime.createSession({});
  const state = await session.read();

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "with scope" },
      },
      responseFormat: "json",
      memoryScope: "scope-a",
    },
  });
  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "without scope" },
      },
      responseFormat: "json",
    },
  });
  await runtime.closeSession(state.sessionId);

  const persistedState = JSON.parse(
    await readFile(resolveSessionStatePath(workdir, state.sessionId), "utf8"),
  ) as { closedMemorySummary?: unknown[] };

  assert.equal(Array.isArray(persistedState.closedMemorySummary), false);
}

async function testRuntimeWritesAllTraceEventsIntoSingleRuntimeTraceFile(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({ workdir });
  const firstSession = await runtime.createSession({});
  const secondSession = await runtime.createSession({});

  await firstSession.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "first trace run" },
      },
      responseFormat: "json",
    },
  });
  await secondSession.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "second trace run" },
      },
      responseFormat: "json",
    },
  });

  const traceFiles = (await readdir(path.join(workdir, ".agent_runtime")))
    .filter((fileName) => /^agent-runtime-trace-.+\.json$/.test(fileName));
  assert.equal(traceFiles.length, 1);

  const traceEvents = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", traceFiles[0]!), "utf8"),
  ) as Array<{ sessionId?: string; runId?: string; eventType?: string }>;
  const runIds = new Set(traceEvents.filter((event) => event.runId).map((event) => event.runId));
  const sessionIds = new Set(traceEvents.filter((event) => event.sessionId).map((event) => event.sessionId));

  assert.equal(runIds.size >= 2, true);
  assert.equal(sessionIds.size >= 2, true);
  assert.equal(traceEvents.some((event) => event.eventType === "plan_started"), true);
  assert.equal(traceEvents.some((event) => event.eventType === "execute_started"), true);
  assert.equal(traceEvents.some((event) => event.eventType === "observe_started"), true);
  assert.equal(traceEvents.some((event) => event.eventType === "validation_failed"), false);
}

async function testRuntimeUsesRealBackendWhenConfigured(): Promise<void> {
  const workdir = await createTestWorkdir();
  const requests: Array<{ url: string; body: string }> = [];
  const fetchFn: FetchLike = async (url, init) => {
    const body = String(init?.body ?? "");
    requests.push({ url: String(url), body });

    if (body.includes("planning component inside AgentRuntime")) {
      const responseBody = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "chat",
                mode: "direct_generation",
                summary: "real plan",
                stepIndex: 1,
                nextStepGoal: "real execute",
                completed: true,
                stopReason: "completed",
              }),
            },
          },
        ],
      };
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify(responseBody);
        },
        async json() {
          return responseBody;
        },
      };
    }

    const responseBody = {
      choices: [
        {
          message: {
            content: "{\"answer\":\"real execution\"}",
          },
        },
      ],
    };
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify(responseBody);
      },
      async json() {
        return responseBody;
      },
    };
  };

  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4.1-mini",
      fetchFn,
    },
  });
  const session = await runtime.createSession({});

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "real runtime" },
      },
      responseFormat: "json",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(requests.length, 2);
  assert.equal(requests.every((entry) => entry.url.endsWith("/chat/completions")), true);
}

async function testRuntimeUsesRealBackendForPlanningRequestContract(): Promise<void> {
  const workdir = await createTestWorkdir();
  const requestBodies: string[] = [];
  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4.1-mini",
      fetchFn: async (_url, init) => {
        const body = String(init?.body ?? "");
        requestBodies.push(body);
        const responseBody = body.includes("planning component inside AgentRuntime")
          ? {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      intent: "chat",
                      mode: "direct_generation",
                      summary: "plan",
                      stepIndex: 1,
                      nextStepGoal: "execute",
                      completed: true,
                      stopReason: "completed",
                    }),
                  },
                },
              ],
            }
          : {
              choices: [
                {
                  message: {
                    content: "{\"answer\":\"ok\"}",
                  },
                },
              ],
            };
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify(responseBody);
          },
          async json() {
            return responseBody;
          },
        };
      },
    },
  });
  const session = await runtime.createSession({});

  await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "real planning contract" },
      },
      responseFormat: "json",
    },
  });

  const planningBody = requestBodies.find((body) => body.includes("planning component inside AgentRuntime"));
  assert.equal(typeof planningBody, "string");
  assert.equal(planningBody?.includes("Only return an ExecutionPlan object."), true);
  assert.equal(planningBody?.includes("Do not add fields outside the ExecutionPlan contract."), true);
}

async function testRuntimeUsesRealBackendForChatJsonPath(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
      fetchFn: async (_url, init) => {
        const body = String(init?.body ?? "");
        const responseBody = body.includes("planning component inside AgentRuntime")
          ? {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      intent: "chat",
                      mode: "direct_generation",
                      summary: "chat plan",
                      stepIndex: 1,
                      nextStepGoal: "answer user",
                      completed: true,
                      stopReason: "completed",
                    }),
                  },
                },
              ],
            }
          : {
              choices: [
                {
                  message: {
                    content: "{\"answer\":\"real chat answer\"}",
                  },
                },
              ],
            };
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify(responseBody);
          },
          async json() {
            return responseBody;
          },
        };
      },
    },
  });
  const session = await runtime.createSession({});

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "real chat runtime" },
      },
      responseFormat: "json",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.payload.content, "{\"answer\":\"real chat answer\"}");
}

async function testRuntimeUsesRealBackendForTaskJsonPath(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
      fetchFn: async (_url, init) => {
        const body = String(init?.body ?? "");
        const responseBody = body.includes("planning component inside AgentRuntime")
          ? {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      intent: "task",
                      mode: "direct_generation",
                      summary: "task plan",
                      stepIndex: 1,
                      nextStepGoal: "produce task json",
                      completed: true,
                      stopReason: "completed",
                    }),
                  },
                },
              ],
            }
          : {
              choices: [
                {
                  message: {
                    content: "{\"summary\":\"task result\",\"result\":{\"ok\":true}}",
                  },
                },
              ],
            };
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify(responseBody);
          },
          async json() {
            return responseBody;
          },
        };
      },
    },
  });
  const session = await runtime.createSession({});

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "write files" },
      },
      responseFormat: "json",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.payload.content, "{\"summary\":\"task result\",\"result\":{\"ok\":true}}");
}

async function testRuntimeCategorizesRealProviderEmptyResponse(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4.1-mini",
      fetchFn: async () => ({
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ choices: [] });
        },
        async json() {
          return { choices: [] };
        },
      }),
    },
  });
  const session = await runtime.createSession({});

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "empty response" },
      },
      responseFormat: "json",
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.some((issue) => issue.code === "provider_empty_response"), true);
}

async function testRuntimeCategorizesRealProviderMalformedOutput(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4.1-mini",
      fetchFn: async () => ({
        ok: true,
        status: 200,
        async text() {
          return "{not-json";
        },
        async json() {
          throw new SyntaxError("Unexpected token n in JSON");
        },
      }),
    },
  });
  const session = await runtime.createSession({});

  const result = await session.execute({
    payload: {
      prompt: {
        systemPrompt: ["system"],
        userPrompt: { task: "malformed response" },
      },
      responseFormat: "json",
    },
  });

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.some((issue) => issue.code === "provider_malformed_output"), true);
}
