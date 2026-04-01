import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createRuntime, MultiAgentProtocol, RunCheckpoint, RuntimeEventBus } from "../src_new/index.js";
import type { RuntimeEvent } from "../src_new/capability/runtime-event.js";
import { McpToolRegistry } from "../src_new/capability/tool-registry.js";
import type { McpGateway, ToolCallInput, ToolCallResult } from "../src_new/capability/types.js";
import { ExecutionStep } from "../src_new/orchestration/peo_agent/peo_execution_step.js";
import { ActionStep } from "../src_new/orchestration/react_agent/react_action_step.js";
import { validateToolCallArguments } from "../src_new/orchestration/tool_call_argument_validator.js";
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
  await testToolArgumentValidatorRejectsInvalidArguments();
  await testReactInvalidToolArgumentsStayInLoopWithoutGatewayCall();
  await testRuntimeCallbackReceivesReactLifecycleEvents();
  await testRuntimeCallbackReceivesPeoTaskAndToolEvents();
  await testPeoExecutionRoutesReactTaskToReactExecutor();
  await testReservedPlaceholdersStayCallable();
}

async function testChatPromptUsesUnifiedContract(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-chat-prompt-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          respond: (prompt: Record<string, unknown>) => {
            assert.equal(prompt.stage, "chat");
            assert.equal(typeof prompt.question, "object");
            assert.equal(typeof prompt.contextBasis, "object");
            assert.equal(typeof prompt.expectedSchema, "object");
            assert.equal(typeof prompt.runtimeState, "object");
            assert.equal("tools" in prompt, false);
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
  const runtime = createRuntime({ workdir });
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
  assert.equal(state.history.some((item) => item.role === "tool"), true);
}

async function testDynamicModeSelectsPeoForSlashPlanCommand(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-dynamic-slash-plan-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          responses: {
            peo_plan: JSON.stringify({
              planSummary: "Slash plan resolved to peo",
              tasks: [],
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
  assert.equal(result.content, "peo from slash command");
}

async function testDynamicModeSelectsReactForFixedBuildKeyword(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-dynamic-build-");
  const runtime = createRuntime({ workdir });
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
  const runtime = createRuntime({ workdir });
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
            if (
              prompt.stage === "react_thought"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              assert.equal(typeof prompt.question, "object");
              assert.equal(typeof prompt.contextBasis, "object");
              assert.equal(typeof prompt.tools, "object");
              assert.equal(typeof prompt.expectedSchema, "object");
              assert.equal(typeof prompt.runtimeState, "object");
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
  const runtime = createRuntime({ workdir });
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
                    taskId: "task-1",
                    description: "use echo_hello and finish the subtask",
                    type: "react",
                    status: "pending",
                  },
                ],
                finalAnswer: "peo observation",
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
  assert.equal(result.content, "peo observation");
  assert.equal(state.history.some((item) => item.role === "tool"), true);
  assert.equal(briefs.includes("model.call.started"), true);
  assert.equal(briefs.includes("tool.call.started"), true);
  const peoPlanInput = peoPlanEvent?.details?.input as Record<string, unknown> | undefined;
  assert.deepEqual(peoPlanInput?.questionKeys, ["task", "workingDirectory"]);
  assert.equal(Boolean(toolEvent), true);
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
              planSummary: "Respond directly",
              tasks: [],
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
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              const tools = prompt.tools as Record<string, unknown>;
              assert.equal(request?.responseFormat, "json");
              assert.equal(typeof prompt.question, "object");
              assert.equal(typeof prompt.contextBasis, "object");
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
                "Use task type react for tool-oriented sub-problems.",
                "Use task type direct for bounded direct work.",
                "Keep tasks abstract and do not output direct toolCall payloads.",
              ]);
              assert.equal(typeof prompt.expectedSchema, "object");
              assert.equal(typeof prompt.runtimeState, "object");
              return JSON.stringify({
                planSummary: "Two-step peo flow",
                tasks: [
                  {
                    taskId: "task-1",
                    description: "Inspect state",
                    type: "direct",
                    status: "pending",
                  },
                  {
                    taskId: "task-2",
                    description: "Finish response",
                    type: "direct",
                    status: "pending",
                    dependsOn: ["task-1"],
                  },
                ],
              });
            }
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 2
            ) {
              const contextBasis = prompt.contextBasis as Record<string, unknown>;
              assert.equal(Array.isArray(contextBasis.priorExecutionSummaries), true);
              return JSON.stringify({
                planSummary: "Second step: finish response",
                tasks: [],
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
      task: "/plan need more than one peo step",
    },
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
            if (
              prompt.stage === "peo_plan"
              && (prompt.runtimeState as Record<string, unknown> | undefined)?.stepIndex === 1
            ) {
              return JSON.stringify({
                planSummary: "Try a missing tool then observe the failure",
                tasks: [
                  {
                    taskId: "task-1",
                    description: "use missing_tool and continue",
                    type: "react",
                    status: "pending",
                  },
                ],
              });
            }
            if (prompt.stage === "react_thought") {
              return JSON.stringify({
                thought: "Use missing tool",
                actionType: "tool",
                toolCalls: [{ name: "missing_tool", arguments: {} }],
                shouldContinue: true,
              });
            }
            if (prompt.stage === "react_observation") {
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
              const contextBasis = prompt.contextBasis as Record<string, unknown>;
              const priorExecutionSummaries = contextBasis.priorExecutionSummaries as unknown[];
              assert.equal(Array.isArray(priorExecutionSummaries), true);
              assert.equal(String(priorExecutionSummaries[0] ?? "").includes("task-1"), true);
              return JSON.stringify({
                planSummary: "Handle missing tool failure",
                tasks: [],
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
      task: "/plan fail tool and continue",
    },
  });

  assert.equal(result.errorCode, undefined);
  assert.equal(result.content, "peo handled tool failure");
}

async function testToolArgumentValidatorRejectsInvalidArguments(): Promise<void> {
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
        async handle(): Promise<ToolCallResult> {
          return { content: "" };
        },
      },
    },
  ]);

  const missingPath = await validateToolCallArguments({
    toolRegistry: registry,
    toolName: "read_text_file",
    arguments: {},
  });
  const wrongType = await validateToolCallArguments({
    toolRegistry: registry,
    toolName: "read_text_file",
    arguments: { path: 1 },
  });
  const unknownField = await validateToolCallArguments({
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
    async call(_input: ToolCallInput): Promise<ToolCallResult> {
      called += 1;
      return { content: "unexpected" };
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
        async handle(): Promise<ToolCallResult> {
          return { content: "" };
        },
      },
    },
  ]);
  const step = new ActionStep(gateway, registry, new RuntimeEventBus([]));

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
  const received: RuntimeEvent[] = [];
  const runtime = createRuntime({
    workdir,
    eventCallback: {
      onEvent(event) {
        received.push(event);
      },
    },
  });
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
    event.type === "model"
    && event.modelMessage.event === "model_started"
  )), true);
  assert.equal(received.some((event) => (
    event.type === "model"
    && event.modelMessage.event === "model_completed"
  )), true);
  assert.equal(received.some((event) => (
    event.type === "agent"
    && event.agentMessage.event === "step"
    && event.agentMessage.agent.name === "react"
    && event.agentMessage.agent.content.step === "thought"
    && (event.agentMessage.agent.content.input.question as Record<string, unknown>)?.task === "/react use tool"
  )), true);
  assert.equal(received.some((event) => (
    event.type === "agent"
    && event.agentMessage.event === "step"
    && event.agentMessage.agent.name === "react"
    && event.agentMessage.agent.content.step === "observation"
    && Array.isArray((event.agentMessage.agent.content.input.action as Record<string, unknown> | undefined)?.actionObservations)
  )), true);
  assert.equal(received.some((event) => (
    event.type === "tool"
    && event.toolMessage.event === "tool_started"
    && event.toolMessage.agent.name === "react"
    && event.toolMessage.tool.toolName === "echo_hello"
  )), true);
  assert.equal(received.some((event) => event.type === "tool" && event.toolMessage.event === "tool_failed"), false);
}

async function testRuntimeCallbackReceivesPeoTaskAndToolEvents(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-peo-events-");
  const received: RuntimeEvent[] = [];
  const runtime = createRuntime({
    workdir,
    eventCallback: {
      onEvent(event) {
        received.push(event);
      },
    },
  });
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
                    taskId: "task-1",
                    description: "use echo_hello tool",
                    type: "react",
                    status: "pending",
                  },
                ],
                finalAnswer: "done",
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
    event.type === "model"
    && event.modelMessage.event === "model_started"
  )), true);
  assert.equal(received.some((event) => (
    event.type === "model"
    && event.modelMessage.event === "model_completed"
  )), true);
  assert.equal(received.some((event) => (
    event.type === "agent"
    && event.agentMessage.event === "step"
    && event.agentMessage.agent.name === "peo"
    && event.agentMessage.agent.content.step === "plan"
    && (event.agentMessage.agent.content.input.question as Record<string, unknown>)?.task === "/plan solve with tool"
  )), true);
  assert.equal(received.some((event) => (
    event.type === "agent"
    && event.agentMessage.event === "step"
    && event.agentMessage.agent.name === "peo"
    && event.agentMessage.agent.content.step === "execution"
    && Array.isArray(event.agentMessage.agent.content.input.tasks)
  )), true);
  assert.equal(received.some((event) => (
    event.type === "agent"
    && event.agentMessage.event === "step"
    && event.agentMessage.agent.name === "peo"
    && event.agentMessage.agent.content.step === "observation"
    && Array.isArray(event.agentMessage.agent.content.input.taskExecutions)
  )), true);
  assert.equal(received.some((event) => (
    event.type === "tool"
    && event.toolMessage.event === "tool_started"
    && event.toolMessage.agent.name === "peo"
    && event.toolMessage.agent.content.step === "execution"
    && event.toolMessage.tool.toolName === "echo_hello"
  )), true);
  assert.equal(received.some((event) => event.type === "tool" && event.toolMessage.event === "tool_failed"), false);
}

async function testPeoExecutionRoutesReactTaskToReactExecutor(): Promise<void> {
  let directCalled = 0;
  let reactCalled = 0;
  const step = new ExecutionStep(
    new RuntimeEventBus([]),
    {
      async execute() {
        directCalled += 1;
        return {
          taskId: "task-1",
          taskStatus: "completed",
          output: "direct output",
          executionFacts: {
            toolCalls: 0,
            failedToolCalls: 0,
          },
        };
      },
    },
    {
      async execute() {
        reactCalled += 1;
        return {
          taskId: "task-2",
          taskStatus: "completed",
          output: "react output",
          executionFacts: {
            toolCalls: 1,
            failedToolCalls: 0,
          },
        };
      },
    },
  );

  const result = await step.run(
    createMinimalAgentContext("peo"),
    "run-1",
    1,
    {
      planSummary: "execute react task",
      tasks: [
        {
          taskId: "task-2",
          description: "read file with tools",
          type: "react",
          status: "pending",
        },
      ],
      finalAnswer: undefined,
    },
  );

  assert.equal(directCalled, 0);
  assert.equal(reactCalled, 1);
  assert.equal(result.tasks[0]?.taskId, "task-2");
  assert.equal(result.taskExecutions[0]?.output, "react output");
  assert.equal(result.taskExecutions[0]?.executionFacts?.toolCalls, 1);
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

async function findOnlyTraceFile(workdir: string): Promise<string> {
  const traceDir = path.join(workdir, ".agent_runtime", "traces");
  const entries = await readdir(traceDir);
  assert.equal(entries.length, 1);
  return path.join(traceDir, entries[0]!);
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
