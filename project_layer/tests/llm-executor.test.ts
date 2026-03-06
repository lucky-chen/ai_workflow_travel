import assert from "node:assert/strict";

import { LlmExecutorService } from "../src/sdk/llm-executor/llm-executor.js";
import type { FetchLike } from "../src/sdk/llm-executor/http-json-client.js";

export async function runLlmExecutorTests(): Promise<void> {
  const mockExecutor = new LlmExecutorService();
  const mockResult = await mockExecutor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: "user",
    },
    responseFormat: "json",
    metadata: {
      requestId: "req-1",
    },
  });

  assert.equal(mockResult.responseFormat, "json");
  assert.deepEqual(mockResult.metadata, { requestId: "req-1" });
  assert.equal(typeof mockResult.content, "string");

  const customMockExecutor = new LlmExecutorService({
    mode: "mock",
    mockContent: JSON.stringify({
      summary: "Custom mock result",
      changed_files: [{ path: "a.ts", operation: "create", content: "export {};\n" }],
    }),
  });
  const customMockResult = await customMockExecutor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: "user",
    },
    responseFormat: "json",
  });

  assert.equal(
    customMockResult.content,
    JSON.stringify({
      summary: "Custom mock result",
      changed_files: [{ path: "a.ts", operation: "create", content: "export {};\n" }],
    }),
  );

  await assert.rejects(
    async () => new LlmExecutorService({ mode: "real" }),
    /provider is required/,
  );

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
        userPrompt: "user",
      },
      responseFormat: "json",
    }),
    /API key is required/,
  );

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
        userPrompt: "user",
      },
      responseFormat: "json",
    }),
    /Model is required/,
  );

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
      userPrompt: "user",
    },
    responseFormat: "json",
    metadata: {
      requestId: "req-real",
    },
  });
  assert.equal(realResult.content, "deepseek ok");
  assert.deepEqual(realResult.metadata, { requestId: "req-real" });

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
      userPrompt: "user prompt",
    },
    responseFormat: "text",
  });
  assert.equal(openAiResult.content, "openai ok");

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
        userPrompt: "user",
      },
      responseFormat: "json",
    }),
    /did not include choices\[0\]\.message\.content/,
  );

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
        userPrompt: "user",
      },
      responseFormat: "json",
    }),
    /HTTP 401: unauthorized/,
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
      { role: "user", content: "user prompt" },
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
