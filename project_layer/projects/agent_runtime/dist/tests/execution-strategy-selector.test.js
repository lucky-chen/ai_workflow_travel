import assert from "node:assert/strict";
import { ExecutionStrategySelector } from "../src/execution-strategy-selector.js";
export async function runExecutionStrategySelectorTests() {
    await testExecutionStrategySelectorDefaultsToMock();
    await testExecutionStrategySelectorChoosesRealProvider();
}
async function testExecutionStrategySelectorDefaultsToMock() {
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
async function testExecutionStrategySelectorChoosesRealProvider() {
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
function createMockFetch(responseBody, status = 200) {
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
