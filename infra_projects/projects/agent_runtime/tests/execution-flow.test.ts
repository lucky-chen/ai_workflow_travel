import assert from "node:assert/strict";

import { ExecutionPromptBuilder } from "../src/loop/execution-prompt-builder.js";
import { ExecutionResultValidator } from "../src/loop/execution-result-validator.js";
import { DefaultExecutor } from "../src/runtime/default-executor.js";
import type {
  AgentContext,
  IModelBackend,
  IMcpGateway,
  McpToolRequest,
  McpToolResult,
  ModelBackendRequest,
  ModelBackendResult,
} from "../src/runtime/agent-runtime.js";

export async function runExecutionFlowTests(): Promise<void> {
  await testExecutionPromptBuilderBuildsExecutionRequest();
  await testDefaultExecutorUsesPromptBuilderAndToolGateway();
  await testExecutionResultValidatorRejectsInvalidJson();
  await testExecutionResultValidatorRejectsInvalidChatJsonAnswer();
  await testExecutionResultValidatorRejectsInvalidTaskJsonSummary();
}

async function testExecutionPromptBuilderBuildsExecutionRequest(): Promise<void> {
  const builder = new ExecutionPromptBuilder();
  const request = builder.build({
    context: createAgentContext(),
    plan: {
      intent: "chat",
      mode: "direct_generation",
      summary: "summary",
      stepIndex: 1,
      nextStepGoal: "Generate output.",
    },
  });

  assert.equal(request.mode, "execution");
  assert.equal(request.prompt.userPrompt.nextStepGoal, "Generate output.");
  assert.equal(request.prompt.userPrompt.intent, "chat");
  assert.deepEqual(request.prompt.userPrompt.outputContract, {
    type: "json_object",
    schema: {
      answer: "string",
    },
  });
}

async function testDefaultExecutorUsesPromptBuilderAndToolGateway(): Promise<void> {
  const backend = new TestModelBackend({
    content: "{\"summary\":\"ok\"}",
    responseFormat: "json",
  });
  const gateway = new TestMcpGateway();
  const executor = new DefaultExecutor(backend, gateway);

  const result = await executor.execute(createAgentContext(), {
    intent: "task",
    mode: "tool_augmented_generation",
    summary: "summary",
    stepIndex: 1,
    nextStepGoal: "Generate output.",
    toolSteps: [
      {
        toolName: "file_read",
        arguments: {
          path: "/tmp/demo.txt",
        },
      },
    ],
  });

  assert.equal(gateway.calls.length, 1);
  assert.equal(backend.requests.length, 1);
  assert.equal(result.toolResults?.length, 1);
}

async function testExecutionResultValidatorRejectsInvalidJson(): Promise<void> {
  const validator = new ExecutionResultValidator();

  const validation = validator.validate(
    {
      content: "not-json",
      responseFormat: "json",
    },
    "json",
  );

  assert.equal(validation.ok, false);
  assert.equal(validation.issues?.[0]?.code, "invalid_json_content");
}

async function testExecutionResultValidatorRejectsInvalidChatJsonAnswer(): Promise<void> {
  const validator = new ExecutionResultValidator();

  const validation = validator.validate(
    {
      content: "{\"summary\":\"not-answer\"}",
      responseFormat: "json",
    },
    "json",
    "chat",
  );

  assert.equal(validation.ok, false);
  assert.equal(validation.issues?.some((issue) => issue.code === "invalid_chat_json_answer"), true);
}

async function testExecutionResultValidatorRejectsInvalidTaskJsonSummary(): Promise<void> {
  const validator = new ExecutionResultValidator();

  const validation = validator.validate(
    {
      content: "{\"result\":{\"ok\":true}}",
      responseFormat: "json",
    },
    "json",
    "task",
  );

  assert.equal(validation.ok, false);
  assert.equal(validation.issues?.some((issue) => issue.code === "invalid_task_json_summary"), true);
}

class TestModelBackend implements IModelBackend {
  readonly requests: ModelBackendRequest[] = [];

  constructor(private readonly result: ModelBackendResult) {}

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    this.requests.push(request);
    return this.result;
  }
}

class TestMcpGateway implements IMcpGateway {
  readonly calls: McpToolRequest[] = [];

  async call(request: McpToolRequest): Promise<McpToolResult> {
    this.calls.push(request);
    return {
      toolName: request.toolName,
      success: true,
      content: "tool-content",
    };
  }
}

function createAgentContext(): AgentContext {
  return {
    request: {
      prompt: {
        systemPrompt: ["caller system prompt"],
        userPrompt: {
          task: "execute",
        },
      },
      responseFormat: "json",
    },
    runtimeContext: {
      sessionId: "session-1",
      workdir: "/tmp/agent-runtime",
      transcript: [],
      memory: [],
      retrievalContext: [],
      mcpToolCalls: [],
    },
  };
}
