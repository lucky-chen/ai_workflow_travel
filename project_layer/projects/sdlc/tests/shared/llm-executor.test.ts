import assert from "node:assert/strict";

import type { FetchLike } from "ai-meta-agent-agent-runtime";
import { InMemoryTraceRecorder } from "../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { LlmExecutorService } from "../../src/SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { loadLocalConfig } from "./load-local-config.js";

export async function runLlmExecutorTests(): Promise<void> {
  await testDefaultMockExecutor();
  await testLlmTraceRecorderIntegration();
  await testPromptListsAreNormalizedBeforeExecution();
  await testRealExecutorTraceMetadata();
  await testLlmExecutorUsesAgentRuntimeTraceCheckpoints();
  await testCustomMockExecutor();
  await testMockExecutorUsesRequestAwareHandler();
  await testRealExecutorRequiresProvider();
  await testRealExecutorRequiresApiKey();
  await testRealExecutorRequiresModel();
  await testDeepSeekExecution();
  await testOpenAiExecution();
  await testInvalidProviderResponse();
  await testHttpErrorResponse();
}

async function testPromptListsAreNormalizedBeforeExecution(): Promise<void> {
  let capturedSystemPrompt = "";
  let capturedUserPrompt = "";
  const executor = new LlmExecutorService({
    mode: "mock",
    mockExecute: async (request) => {
      capturedSystemPrompt = request.prompt.systemPrompt;
      capturedUserPrompt = request.prompt.userPrompt;
      return {
        content: "normalized",
        responseFormat: request.responseFormat,
      };
    },
  });

  const result = await executor.execute({
    prompt: {
      systemPrompt: ["system part 1", "system part 2"],
      userPrompt: {
        part1: "user part 1",
        part2: "user part 2",
      },
    },
    responseFormat: "text",
  });

  assert.equal(result.content, "normalized");
  assert.equal(capturedSystemPrompt, "system part 1\n\nsystem part 2");
  assert.equal(capturedUserPrompt, "{\n  \"part1\": \"user part 1\",\n  \"part2\": \"user part 2\"\n}");
}

async function testLlmTraceRecorderIntegration(): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const executor = new LlmExecutorService({
    mockContent: "trace-aware mock",
    traceRecorder,
  });

  const result = await executor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: { input: "user" },
    },
    responseFormat: "text",
  });

  assert.equal(result.content, "trace-aware mock");
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "llm_execution_started",
    "agent_plan_created",
    "agent_execution_started",
    "agent_execution_finished",
    "agent_observation_finished",
    "llm_execution_finished",
  ]);
  assert.deepEqual(
    traceRecorder.getEvents()
      .filter((entry) => entry.event.caller === "LlmExecutorService.execute")
      .map((entry) => entry.event.metadata?.mode),
    ["mock", "mock"],
  );
}

async function testRealExecutorTraceMetadata(): Promise<void> {
  const localConfig = await loadLocalConfig();
  const provider = localConfig.llm?.provider ?? "openai";
  const model = localConfig.llm?.model ?? "gpt-4.1-mini";
  const baseUrl = localConfig.llm?.base_url
    ?? (provider === "deepseek" ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1");
  const expectedUrl = provider === "deepseek"
    ? `${baseUrl.replace(/\/$/, "")}/chat/completions`
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const traceRecorder = new InMemoryTraceRecorder();
  const executor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider,
      apiKey: "test-api-key",
      model,
      baseUrl,
      fetchFn: createAssertingFetch(expectedUrl, model, {
        choices: [
          {
            message: {
              content: `${provider} traced`,
            },
          },
        ],
      }),
    },
    traceRecorder,
  });

  await executor.execute({
    prompt: {
      systemPrompt: "system prompt",
      userPrompt: { input: "user prompt" },
    },
    responseFormat: "text",
  });

  const llmEvents = traceRecorder.getEvents()
    .filter((entry) => entry.event.caller === "LlmExecutorService.execute");
  assert.equal(llmEvents.length, 2);
  assert.deepEqual(
    llmEvents.map((entry) => entry.event.metadata),
    [
      { mode: "real", provider, responseFormat: "text" },
      { mode: "real", provider, responseFormat: "text" },
    ],
  );
}

async function testLlmExecutorUsesAgentRuntimeTraceCheckpoints(): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const executor = new LlmExecutorService({
    mockContent: "agent-runtime integrated",
    traceRecorder,
  });

  const result = await executor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: { input: "user" },
    },
    responseFormat: "json",
    metadata: {
      requestId: "req-agent-runtime",
    },
  });

  assert.equal(result.content, "agent-runtime integrated");
  assert.deepEqual(
    traceRecorder.getEvents().filter((entry) => entry.event.metadata?.runId === "req-agent-runtime")
      .map((entry) => entry.event.eventType),
    [
      "agent_plan_created",
      "agent_execution_started",
      "agent_execution_finished",
      "agent_observation_finished",
    ],
  );
}

async function testDefaultMockExecutor(): Promise<void> {
  const mockExecutor = new LlmExecutorService();
  const mockResult = await mockExecutor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: { input: "user" },
    },
    responseFormat: "json",
    metadata: {
      requestId: "req-1",
    },
  });

  assert.equal(mockResult.responseFormat, "json");
  assert.deepEqual(mockResult.metadata, { requestId: "req-1" });
  assert.equal(typeof mockResult.content, "string");
}

async function testCustomMockExecutor(): Promise<void> {
  const customMockExecutor = new LlmExecutorService({
    mode: "mock",
    mockContent: JSON.stringify({
      summary: "Custom mock result",
      prompt: "Apply the scripted workspace update.",
    }),
  });
  const customMockResult = await customMockExecutor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: { input: "user" },
    },
    responseFormat: "json",
  });

  assert.equal(
    customMockResult.content,
    JSON.stringify({
      summary: "Custom mock result",
      prompt: "Apply the scripted workspace update.",
    }),
  );
}

async function testMockExecutorUsesRequestAwareHandler(): Promise<void> {
  const executor = new LlmExecutorService({
    mode: "mock",
    mockExecute: async (request) => ({
      content: request.metadata?.executionUnit === "work_execute"
        ? "{\"summary\":\"scripted\",\"prompt\":\"Apply scripted workspace update.\"}"
        : "scripted-text",
      responseFormat: request.responseFormat,
      metadata: request.metadata,
    }),
  });

  const result = await executor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: { input: "user" },
    },
    responseFormat: "json",
    metadata: {
      executionUnit: "work_execute",
    },
  });

  assert.equal(result.content, "{\"summary\":\"scripted\",\"prompt\":\"Apply scripted workspace update.\"}");
  assert.equal(result.responseFormat, "json");
}

async function testRealExecutorRequiresProvider(): Promise<void> {
  await assert.rejects(
    async () => new LlmExecutorService({ mode: "real" }),
    /provider is required/,
  );
}

async function testRealExecutorRequiresApiKey(): Promise<void> {
  const missingApiKeyExecutor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider: "openai",
      model: "gpt-4.1-mini",
    },
  });
  await assert.rejects(
    missingApiKeyExecutor.execute({
      prompt: {
        systemPrompt: "system",
        userPrompt: { input: "user" },
      },
      responseFormat: "json",
    }),
    /API key is required/,
  );
}

async function testRealExecutorRequiresModel(): Promise<void> {
  const missingModelExecutor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider: "deepseek",
      apiKey: "deepseek-key",
    },
  });
  await assert.rejects(
    missingModelExecutor.execute({
      prompt: {
        systemPrompt: "system",
        userPrompt: { input: "user" },
      },
      responseFormat: "json",
    }),
    /Model is required/,
  );
}

async function testDeepSeekExecution(): Promise<void> {
  const realExecutor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
      timeoutMs: 15000,
      fetchFn: createMockFetch({
        choices: [
          {
            message: {
              content: "deepseek ok",
            },
          },
        ],
      }),
    },
  });
  const realResult = await realExecutor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: { input: "user" },
    },
    responseFormat: "json",
    metadata: {
      requestId: "req-real",
    },
  });
  assert.equal(realResult.content, "deepseek ok");
  assert.deepEqual(realResult.metadata, { requestId: "req-real" });
}

async function testOpenAiExecution(): Promise<void> {
  const openAiExecutor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      fetchFn: createAssertingFetch("https://api.openai.com/v1/chat/completions", "gpt-4.1-mini", {
        choices: [
          {
            message: {
              content: "openai ok",
            },
          },
        ],
      }),
    },
  });
  const openAiResult = await openAiExecutor.execute({
    prompt: {
      systemPrompt: "system prompt",
      userPrompt: { input: "user prompt" },
    },
    responseFormat: "text",
  });
  assert.equal(openAiResult.content, "openai ok");
}

async function testInvalidProviderResponse(): Promise<void> {
  const invalidResponseExecutor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
      fetchFn: createMockFetch({ choices: [] }),
    },
  });
  await assert.rejects(
    invalidResponseExecutor.execute({
      prompt: {
        systemPrompt: "system",
        userPrompt: { input: "user" },
      },
      responseFormat: "json",
    }),
    /did not include choices\[0\]\.message\.content/,
  );
}

async function testHttpErrorResponse(): Promise<void> {
  const httpErrorExecutor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4.1-mini",
      fetchFn: async () => ({
        ok: false,
        status: 401,
        async text() {
          return "unauthorized";
        },
        async json() {
          return { error: "unauthorized" };
        },
      }),
    },
  });
  await assert.rejects(
    httpErrorExecutor.execute({
      prompt: {
        systemPrompt: "system",
        userPrompt: { input: "user" },
      },
      responseFormat: "json",
    }),
    /HTTP request failed with status 401: unauthorized/,
  );
}

function createMockFetch(responseJson: unknown): FetchLike {
  return async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify(responseJson);
    },
    async json() {
      return responseJson;
    },
  });
}

function createAssertingFetch(expectedUrl: string, expectedModel: string, responseJson: unknown): FetchLike {
  return async (input, init) => {
    assert.equal(input, expectedUrl);
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization.startsWith("Bearer "), true);

    const parsedBody = JSON.parse(init.body) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    assert.equal(parsedBody.model, expectedModel);
    assert.deepEqual(parsedBody.messages, [
      { role: "system", content: "system prompt" },
      { role: "user", content: "{\n  \"input\": \"user prompt\"\n}" },
    ]);

    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify(responseJson);
      },
      async json() {
        return responseJson;
      },
    };
  };
}
