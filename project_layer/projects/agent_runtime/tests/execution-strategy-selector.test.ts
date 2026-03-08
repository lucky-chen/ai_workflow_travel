import assert from "node:assert/strict";

import { ExecutionStrategySelector } from "../src/execution-strategy-selector.js";
import type { FetchLike } from "../src/http-json-client.js";

export async function runExecutionStrategySelectorTests(): Promise<void> {
  await testExecutionStrategySelectorDefaultsToMock();
  await testExecutionStrategySelectorChoosesRealProvider();
}

async function testExecutionStrategySelectorDefaultsToMock(): Promise<void> {
  const selector = new ExecutionStrategySelector();
  const strategy = selector.select({
    mockContent: "mock content",
  });

  assert.equal(strategy.mode, "mock");
  const result = await strategy.executor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: "user",
    },
    responseFormat: "text",
  });
  assert.equal(result.content, "mock content");
}

async function testExecutionStrategySelectorChoosesRealProvider(): Promise<void> {
  const selector = new ExecutionStrategySelector();
  const strategy = selector.select({
    mode: "real",
    realProvider: {
      provider: "deepseek",
      apiKey: "deepseek-key",
      model: "deepseek-chat",
      fetchFn: createMockFetch({
        choices: [
          {
            message: {
              content: "selected deepseek",
            },
          },
        ],
      }),
    },
  });

  assert.equal(strategy.mode, "real");
  const result = await strategy.executor.execute({
    prompt: {
      systemPrompt: "system",
      userPrompt: "user",
    },
    responseFormat: "text",
  });
  assert.equal(result.content, "selected deepseek");
}

function createMockFetch(responseBody: unknown, status = 200): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(responseBody);
    },
    async json() {
      return responseBody;
    },
  });
}
