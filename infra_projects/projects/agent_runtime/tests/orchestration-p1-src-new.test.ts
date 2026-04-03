import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createSessionApi } from "../src/interface/api.js";
import { createRunCheckpoint } from "../src/runtime/run-checkpoint.js";
import { MultiAgentProtocol } from "../src/orchestration/multi_agent_protocol.js";
import type { SessionEvent } from "../src/interface/api.js";
import { McpToolRegistry } from "../src/capability/tool-registry.js";
import type { McpGateway, ToolCallInput, ToolCallResult } from "../src/capability/types.js";
import { ExecutionStep } from "../src/orchestration/peo_agent/peo_execution_step.js";
import { ActionStep } from "../src/orchestration/react_agent/react_action_step.js";
import { validateToolCallArguments } from "../src/orchestration/tool_call_argument_validator.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runOrchestrationP1SrcNewTests(): Promise<void> {
  await testChatPromptUsesUnifiedContract();
  await testSelectorAndChatExecutionPath();
  await testDynamicModeSelectsReactForThoughtDrivenToolRequests();
  await testDynamicModeSelectsPeoForSlashPlanCommand();
  await testDynamicModeSelectsReactForFixedBuildKeyword();
  await testDynamicModeSelectsChatForFixedQuestionKeyword();
  await testReactDoesNotCallToolWithoutThoughtAction();
  await testReactCanContinueToSecondStepBeforeCompletion();
  await testExplicitPeoModeRunsPlanDrivenToolPathWithTrace();
  await testPeoDoesNotCallToolWithoutPlanAction();
  await testPeoCanContinueToSecondStepBeforeCompletion();
  await testPeoToolFailureStillFlowsIntoObserve();
  testToolArgumentValidatorRejectsInvalidArguments();
  await testReactInvalidToolArgumentsStayInLoopWithoutGatewayCall();
  await testRuntimeCallbackReceivesReactLifecycleEvents();
  await testRuntimeCallbackReceivesPeoTaskAndToolEvents();
  await testPeoExecutionRoutesReactTaskToReactExecutor();
  await testReservedPlaceholdersStayCallable();
}

async function testChatPromptUsesUnifiedContract(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-chat-prompt-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            assert.equal(prompt.stage, "chat");
            assert.equal(typeof prompt.question, "object");
            assert.equal(typeof prompt.responseContract, "object");
            assert.equal("tools" in prompt, false);
            assert.equal("contextBasis" in prompt, false);
            assert.equal("runtimeState" in prompt, false);
            return "chat result";
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "what is hello",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "chat result");
}

async function testSelectorAndChatExecutionPath(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-chat-");
  const runtime = createSessionApi({ workdir });
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
      task: "what is hello",
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "chat result");
  assert.equal(state.history.at(-1)?.role, "assistant");
}

async function testDynamicModeSelectsReactForThoughtDrivenToolRequests(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: () => JSON.stringify({
            thought: "Use echo tool",
            actionType: "tool",
            toolCalls: [{ name: "echo_hello", arguments: {} }],
            finalAnswer: "react result",
            shouldContinue: true,
          }),
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/react use tool",
      workingDirectory: workdir,
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react result");
  assert.equal(state.history.at(-1)?.content, "react result");
}

async function testDynamicModeSelectsPeoForSlashPlanCommand(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-dynamic-slash-plan-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          responses: {
            peo_plan: JSON.stringify({
              planSummary: "Slash plan resolved to peo",
                tasks: [
                  {
                    name: "task-1",
                    description: "reply with peo from slash command",
                  },
                ],
            }),
            peo_observation_finalize: "peo from slash command",
            react_thought: JSON.stringify({
              thought: "reply directly",
              actionType: "respond",
              finalAnswer: "peo from slash command",
            }),
            react_observation: JSON.stringify({
              summary: "reply directly",
              completed: true,
              finalAnswer: "peo from slash command",
            }),
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/plan summarize the task",
    },
  });

  assert.equal(result.errorCode, undefined);
  assertPeoSummaryOutput(result.content, "task-1", "peo from slash command");
}

async function testDynamicModeSelectsReactForFixedBuildKeyword(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-dynamic-build-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: () => JSON.stringify({
            thought: "Run build tool flow",
            actionType: "respond",
            finalAnswer: "react from build keyword",
            shouldContinue: false,
          }),
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "build the project",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react from build keyword");
}

async function testDynamicModeSelectsChatForFixedQuestionKeyword(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-dynamic-chat-keyword-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "chat from keyword",
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "what is agent runtime",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "chat from keyword");
}

async function testReactDoesNotCallToolWithoutThoughtAction(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-no-tool-");
  const runtime = createSessionApi({ workdir });
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
      task: "/react do not use tool",
      toolName: "echo_hello",
      toolPayload: {
        content: "should not run",
      },
      workingDirectory: workdir,
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react direct answer");
  assert.equal(state.history.at(-1)?.content, "react direct answer");
}

async function testReactCanContinueToSecondStepBeforeCompletion(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-loop-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (
              prompt.stage === "react_thought"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              assert.equal(typeof prompt.question, "object");
              assert.equal(typeof prompt.tools, "object");
              assert.equal(typeof prompt.responseContract, "object");
              assert.equal(typeof prompt.runtimeState, "object");
              assert.equal("contextBasis" in prompt, false);
              return JSON.stringify({
                thought: "Inspect first",
                actionType: "respond",
                shouldContinue: true,
              });
            }
            if (
              prompt.stage === "react_observation"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              return JSON.stringify({
                summary: "Need another react step",
                completed: false,
              });
            }
            if (
              prompt.stage === "react_thought"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 2
            ) {
              return JSON.stringify({
                thought: "Finish now",
                actionType: "respond",
                finalAnswer: "react two-step answer",
                shouldContinue: false,
              });
            }
            if (
              prompt.stage === "react_observation"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 2
            ) {
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
      task: "/react need more than one react step",
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "react two-step answer");
  assert.equal(state.history.at(-1)?.content, "react two-step answer");
}

async function testExplicitPeoModeRunsPlanDrivenToolPathWithTrace(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (prompt.stage === "peo_plan") {
              return JSON.stringify({
                planSummary: "Use react subtask to execute plan",
                tasks: [
                  {
                    name: "task-1",
                    description: "use echo_hello then reply with react subtask completed",
                  },
                ],
            });
            }
            if (prompt.stage === "react_thought") {
              return JSON.stringify({
                thought: "Use echo tool",
                actionType: "tool",
                toolCalls: [{ name: "echo_hello", arguments: {} }],
                shouldContinue: true,
              });
            }
            if (prompt.stage === "react_observation") {
              return JSON.stringify({
                summary: "react subtask completed",
                completed: true,
                finalAnswer: "react subtask completed",
              });
            }
            if (prompt.stage === "peo_observation_finalize") {
              return "react subtask completed";
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/plan execute observe",
      workingDirectory: workdir,
    },
  });
  const state = await session.load();
  const tracePayload = JSON.parse(
    await readFile(await findOnlyTraceFile(workdir), "utf8"),
  ) as { events?: Array<{ type?: string; brief?: string; details?: Record<string, unknown> }> };
  const briefs = (tracePayload.events ?? []).map((event) => event.brief);
  const peoPlanEvent = (tracePayload.events ?? []).find((event) =>
    event.brief === "peo.plan.input"
    && event.details?.agent === "peo"
    && event.details?.step === "plan"
  );
  const toolEvent = (tracePayload.events ?? []).find((event) => event.brief === "tool.call.started" && event.details?.toolName === "echo_hello");

  assert.equal(result.errorCode, undefined);
  assertPeoSummaryOutput(result.content, "task-1", "react subtask completed");
  assertPeoSummaryOutput(state.history.at(-1)?.content, "task-1", "react subtask completed");
  assert.equal(briefs.includes("model.call.started"), true);
  assert.equal(briefs.includes("tool.call.started"), true);
  const peoPlanInput = peoPlanEvent?.details?.input as Record<string, unknown> | undefined;
  const peoPlanQuestion = peoPlanInput?.question as Record<string, unknown> | undefined;
  assert.equal(peoPlanQuestion?.task, "/plan execute observe");
  assert.equal(peoPlanQuestion?.workingDirectory, workdir);
  assert.equal(Boolean(toolEvent), true);
}

async function testPeoDoesNotCallToolWithoutPlanAction(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-no-tool-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          responses: {
            peo_plan: JSON.stringify({
              planSummary: "Respond directly",
                tasks: [
                  {
                    name: "task-1",
                    description: "reply with peo direct answer",
                  },
                ],
            }),
            peo_observation_finalize: "peo direct answer",
            react_thought: JSON.stringify({
              thought: "reply directly",
              actionType: "respond",
              finalAnswer: "peo direct answer",
            }),
            react_observation: JSON.stringify({
              summary: "reply directly",
              completed: true,
              finalAnswer: "peo direct answer",
            }),
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/plan respond directly",
      toolName: "echo_hello",
      toolPayload: {
        content: "should not run",
      },
      workingDirectory: workdir,
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assertPeoSummaryOutput(result.content, "task-1", "peo direct answer");
  assertPeoSummaryOutput(state.history.at(-1)?.content, "task-1", "peo direct answer");
}

async function testPeoCanContinueToSecondStepBeforeCompletion(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-loop-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>, request?: { responseFormat?: string }) => {
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              const tools = prompt.tools as Record<string, unknown>;
              assert.equal(request?.responseFormat, "json");
              assert.equal(typeof prompt.question, "object");
              assert.equal(typeof prompt.tools, "object");
              assert.deepEqual(tools.availableTools, [
                {
                  name: "echo_hello",
                  description: "Return the fixed text hello. Test-only built-in tool.",
                  inputSchema: {
                    type: "object",
                  },
                  outputSchema: {
                    type: "object",
                    required: ["content"],
                    properties: {
                      content: {
                        type: "string",
                      },
                    },
                  },
                },
              ]);
              assert.deepEqual(tools.taskTypeRules, [
                "Keep tasks abstract and do not output direct toolCall payloads.",
                "Return tasks in execution order.",
              ]);
              assert.equal(typeof prompt.responseContract, "object");
              assert.equal(typeof prompt.runtimeState, "object");
              assert.equal("contextBasis" in prompt, false);
              return JSON.stringify({
                planSummary: "Two-step peo flow",
                tasks: [
                  {
                    name: "task-1",
                    description: "Inspect state",
                  },
                ],
              });
            }
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 2
            ) {
              return JSON.stringify({
                planSummary: "Second step: finish response",
                tasks: [
                  {
                    name: "task-3",
                    description: "reply with peo two-step answer",
                  },
                ],
              });
            }
            if (
              prompt.stage === "react_thought"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "Inspect state"
            ) {
              return JSON.stringify({
                thought: "reply directly",
                actionType: "respond",
                finalAnswer: "inspect result",
              });
            }
            if (
              prompt.stage === "react_observation"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "Inspect state"
            ) {
              return JSON.stringify({
                summary: "inspect result",
                completed: true,
                finalAnswer: "inspect result",
              });
            }
            if (
              prompt.stage === "react_thought"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "reply with peo two-step answer"
            ) {
              return JSON.stringify({
                thought: "reply directly",
                actionType: "respond",
                finalAnswer: "peo two-step answer",
              });
            }
            if (
              prompt.stage === "react_observation"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "reply with peo two-step answer"
            ) {
              return JSON.stringify({
                summary: "reply directly",
                completed: true,
                finalAnswer: "peo two-step answer",
              });
            }
            if (prompt.stage === "peo_observation_finalize") {
              return "peo two-step answer";
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/plan need more than one peo step",
    },
  });
  const state = await session.load();

  assert.equal(result.errorCode, undefined);
  assertPeoSummaryOutput(result.content, "task-1", "inspect result");
  assertPeoSummaryOutput(state.history.at(-1)?.content, "task-1", "inspect result");
  assert.equal(state.history.filter((item) => item.role === "assistant").length >= 1, true);
}

async function testPeoToolFailureStillFlowsIntoObserve(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-tool-failure-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              return JSON.stringify({
                planSummary: "Try a missing tool then observe the failure",
                tasks: [
                  {
                    name: "task-1",
                    description: "use missing_tool and continue",
                  },
                ],
              });
            }
            if (
              prompt.stage === "react_thought"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "use missing_tool and continue"
            ) {
              return JSON.stringify({
                thought: "Use missing tool",
                actionType: "tool",
                toolCalls: [{ name: "missing_tool", arguments: {} }],
                shouldContinue: true,
              });
            }
            if (
              prompt.stage === "react_observation"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "use missing_tool and continue"
            ) {
              return JSON.stringify({
                summary: "react child observed tool failure",
                completed: true,
                finalAnswer: "react child observed tool failure",
              });
            }
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 2
            ) {
              return JSON.stringify({
                planSummary: "Handle missing tool failure",
                tasks: [
                  {
                    name: "task-2",
                    description: "reply with peo handled tool failure",
                  },
                ],
              });
            }
            if (
              prompt.stage === "react_thought"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "reply with peo handled tool failure"
            ) {
              return JSON.stringify({
                thought: "reply directly",
                actionType: "respond",
                finalAnswer: "peo handled tool failure",
              });
            }
            if (
              prompt.stage === "react_observation"
              && (prompt.question as Record<string, unknown> | undefined)?.task === "reply with peo handled tool failure"
            ) {
              return JSON.stringify({
                summary: "reply directly",
                completed: true,
                finalAnswer: "peo handled tool failure",
              });
            }
            if (prompt.stage === "peo_observation_finalize") {
              return "peo handled tool failure";
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/plan fail tool and continue",
    },
  });

  assert.equal(result.errorCode, undefined);
  assertPeoSummaryOutput(result.content, "task-1", "react child observed tool failure");
}

function testToolArgumentValidatorRejectsInvalidArguments(): void {
  const registry = new McpToolRegistry([
    {
      name: "read_text_file",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
        },
      },
      handler: {
        handle(): Promise<ToolCallResult> {
          return Promise.resolve({ content: "" });
        },
      },
    },
  ]);

  const missingPath = validateToolCallArguments({
    toolRegistry: registry,
    toolName: "read_text_file",
    arguments: {},
  });
  const wrongType = validateToolCallArguments({
    toolRegistry: registry,
    toolName: "read_text_file",
    arguments: { path: 1 },
  });
  const unknownField = validateToolCallArguments({
    toolRegistry: registry,
    toolName: "read_text_file",
    arguments: { path: "/tmp/a.txt", extra: true },
  });

  assert.equal(missingPath.valid, false);
  assert.equal(missingPath.errors.includes("Missing required argument \"path\"."), true);
  assert.equal(wrongType.valid, false);
  assert.equal(wrongType.errors.includes("Argument \"path\" must be of type string."), true);
  assert.equal(unknownField.valid, false);
  assert.equal(unknownField.errors.includes("Unknown argument \"extra\"."), true);
}

async function testReactInvalidToolArgumentsStayInLoopWithoutGatewayCall(): Promise<void> {
  let called = 0;
  const gateway: McpGateway = {
    call(_input: ToolCallInput): Promise<ToolCallResult> {
      void _input;
      called += 1;
      return Promise.resolve({ content: "unexpected" });
    },
    withTrace() {
      return this;
    },
  };
  const registry = new McpToolRegistry([
    {
      name: "read_text_file",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string" },
        },
      },
      handler: {
        handle(): Promise<ToolCallResult> {
          return Promise.resolve({ content: "" });
        },
      },
    },
  ]);
  const step = new ActionStep(gateway, registry, async () => {});

  const result = await step.run(
    createMinimalAgentContext("react"),
    "run-1",
    1,
    {
      thought: "read file",
      actionType: "tool",
      toolCalls: [{ name: "read_text_file", arguments: {} }],
      shouldContinue: true,
    },
  );

  assert.equal(called, 0);
  assert.equal(result.toolCalls, 0);
  assert.equal(result.failedToolCalls, 0);
  assert.equal(result.shouldContinue, true);
  assert.equal(result.observation.includes("Tool argument validation failed for read_text_file"), true);
}

async function testRuntimeCallbackReceivesReactLifecycleEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-react-events-");
  const received: SessionEvent[] = [];
  const runtime = createSessionApi({ workdir });
  const listener = {
    onEvent(event: SessionEvent) {
      received.push(event);
    },
  };
  runtime.subscribeEvents(listener);
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (prompt.stage === "react_thought") {
              return JSON.stringify({
                thought: "use tool",
                actionType: "tool",
                toolCalls: [{ name: "echo_hello", arguments: {} }],
                shouldContinue: false,
                finalAnswer: "done",
              });
            }
            if (prompt.stage === "react_observation") {
              return JSON.stringify({
                summary: "done",
                completed: true,
                finalAnswer: "done",
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
      task: "/react use tool",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(received.some((event) => (
    event.brief === "run_started"
  )), true);
  assert.equal(received.some((event) => (
    event.brief === "context_assembled"
  )), true);
  assert.equal(received.some((event) => (
    event.brief === "state_persisted"
  )), true);
  assert.equal(received.some((event) => (
    event.brief === "run_finished"
  )), true);
  runtime.unsubscribeEvents(listener);
}

async function testRuntimeCallbackReceivesPeoTaskAndToolEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-events-");
  const received: SessionEvent[] = [];
  const runtime = createSessionApi({ workdir });
  const listener = {
    onEvent(event: SessionEvent) {
      received.push(event);
    },
  };
  runtime.subscribeEvents(listener);
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            if (prompt.stage === "peo_plan") {
              return JSON.stringify({
                planSummary: "read with react",
                tasks: [
                  {
                    name: "task-1",
                    description: "use echo_hello tool then reply with done",
                  },
                ],
            });
            }
            if (prompt.stage === "react_thought") {
              return JSON.stringify({
                thought: "use tool",
                actionType: "tool",
                toolCalls: [{ name: "echo_hello", arguments: {} }],
                shouldContinue: false,
                finalAnswer: "done",
              });
            }
            if (prompt.stage === "react_observation") {
              return JSON.stringify({
                summary: "done",
                completed: true,
                finalAnswer: "done",
              });
            }
            if (prompt.stage === "peo_observation_finalize") {
              return "done";
            }
            throw new Error(`Unexpected prompt: ${JSON.stringify(prompt)}`);
          },
        },
      },
    },
  });

  const result = await session.execute({
    content: {
      task: "/plan solve with tool",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(received.some((event) => (
    event.brief === "run_started"
  )), true);
  assert.equal(received.some((event) => (
    event.brief === "context_assembled"
  )), true);
  assert.equal(received.some((event) => (
    event.brief === "state_persisted"
  )), true);
  assert.equal(received.some((event) => (
    event.brief === "run_finished"
  )), true);
  runtime.unsubscribeEvents(listener);
}

async function testPeoExecutionRoutesReactTaskToReactExecutor(): Promise<void> {
  let reactCalled = 0;
  const step = new ExecutionStep(
    {
      execute() {
        reactCalled += 1;
        return Promise.resolve({
          output: "react output",
          error: {
            code: 0,
            message: "",
          },
          executionFacts: {
            toolCalls: 1,
            failedToolCalls: 0,
          },
        });
      },
    },
    () => Promise.resolve(),
  );

  const result = await step.run(
    createMinimalAgentContext("peo"),
    "run-1",
    1,
    {
      planSummary: "execute react task",
      tasks: [
        {
          name: "task-2",
          description: "read file with tools",
        },
      ],
    },
  );

  assert.equal(reactCalled, 1);
  assert.equal(result.tasks[0]?.name, "task-2");
  assert.equal(result.taskResults[0]?.output, "react output");
  assert.equal(result.taskResults[0]?.executionFacts?.toolCalls, 1);
}

async function testReservedPlaceholdersStayCallable(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-placeholder-");
  const runtime = createSessionApi({ workdir });
  const session = await runtime.createSession({});
  const loaded = await session.load();
  const protocol = new MultiAgentProtocol();
  const checkpoint = createRunCheckpoint({
    load() {
      return Promise.resolve({});
    },
    save() {
      return Promise.resolve();
    },
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

async function findOnlyTraceFile(workdir: string): Promise<string> {
  const traceDir = path.join(workdir, ".agent_runtime", "traces");
  const entries = await readdir(traceDir);
  assert.equal(entries.length, 1);
  return path.join(traceDir, entries[0]);
}

function createMinimalAgentContext(requestedMode: "react" | "peo") {
  return {
    originalContext: {
      transcriptContext: { turns: [] },
      runtimeMemoryContext: { summaryItems: [] },
      retrievalContext: { fragments: [] },
    },
    boundedContext: {
      transcriptContext: { turns: [] },
      runtimeMemoryContext: { summaryItems: [] },
      retrievalContext: { fragments: [] },
    },
    runtimeContext: {
      requestedMode,
      sessionId: "session-1",
      userInput: {
        content: {
          task: "test",
        },
      },
      modelConfig: {
        mock: true,
        modeSelection: {},
      },
    },
  } as unknown as Parameters<ActionStep["run"]>[0];
}

function assertPeoSummaryOutput(content: unknown, expectedName: string, expectedOutput: string): void {
  if (typeof content !== "string") {
    throw new Error(`Expected string content, received ${typeof content}.`);
  }
  const parsed = JSON.parse(content) as {
    conclusion?: {
      completedCount?: number;
      incompleteCount?: number;
      failedCount?: number;
    };
    tasks?: Array<{
      name?: string;
      description?: string;
      status?: string;
      output?: string;
    }>;
  };
  assert.equal(parsed.conclusion?.completedCount, 1);
  assert.equal(parsed.conclusion?.incompleteCount, 0);
  assert.equal(parsed.conclusion?.failedCount, 0);
  assert.equal(parsed.tasks?.[0]?.name, expectedName);
  assert.equal(parsed.tasks?.[0]?.status, "completed");
  assert.equal(parsed.tasks?.[0]?.output, expectedOutput);
}
