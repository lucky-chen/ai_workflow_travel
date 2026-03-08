import { HttpJsonClient } from "./http-json-client.js";
export class ExecutionStrategySelector {
    select(dependencies = {}) {
        if (dependencies.mode === "real") {
            return {
                mode: "real",
                executor: createRealProviderExecutor(dependencies.realProvider),
            };
        }
        return {
            mode: "mock",
            executor: new MockModelExecutionBackend(dependencies.mockContent),
        };
    }
}
export class MockModelExecutionBackend {
    mockContent;
    constructor(mockContent) {
        this.mockContent = mockContent;
    }
    async execute(request) {
        return {
            content: this.mockContent ??
                JSON.stringify({
                    summary: "Mock implementation change set",
                    changed_files: [],
                    request_preview: request.prompt.userPrompt.slice(0, 200),
                }),
            responseFormat: request.responseFormat,
            metadata: request.metadata,
        };
    }
}
export class OpenAiModelExecutionBackend {
    config;
    httpClient;
    constructor(config) {
        this.config = config;
        this.httpClient = new HttpJsonClient(config.fetchFn);
    }
    async execute(request) {
        validateRealProviderConfig(this.config, "openai");
        const response = await this.httpClient.postJson(buildOpenAiChatCompletionsUrl(this.config), {
            headers: {
                authorization: `Bearer ${this.config.apiKey}`,
            },
            body: {
                model: this.config.model,
                messages: [
                    { role: "system", content: request.prompt.systemPrompt },
                    { role: "user", content: request.prompt.userPrompt },
                ],
            },
            timeoutMs: this.config.timeoutMs,
        });
        const content = response.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
            throw new Error("OpenAI response did not include choices[0].message.content.");
        }
        return {
            content,
            responseFormat: request.responseFormat,
            metadata: request.metadata,
        };
    }
}
export class DeepSeekModelExecutionBackend {
    config;
    httpClient;
    constructor(config) {
        this.config = config;
        this.httpClient = new HttpJsonClient(config.fetchFn);
    }
    async execute(request) {
        validateRealProviderConfig(this.config, "deepseek");
        const response = await this.httpClient.postJson(buildDeepSeekChatCompletionsUrl(this.config), {
            headers: {
                authorization: `Bearer ${this.config.apiKey}`,
            },
            body: {
                model: this.config.model,
                messages: [
                    { role: "system", content: request.prompt.systemPrompt },
                    { role: "user", content: request.prompt.userPrompt },
                ],
            },
            timeoutMs: this.config.timeoutMs,
        });
        const content = response.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
            throw new Error("DeepSeek response did not include choices[0].message.content.");
        }
        return {
            content,
            responseFormat: request.responseFormat,
            metadata: request.metadata,
        };
    }
}
function createRealProviderExecutor(config = {}) {
    if (!config.provider) {
        throw new Error("Real LLM provider is required when mode is set to real.");
    }
    if (config.provider === "openai") {
        return new OpenAiModelExecutionBackend(config);
    }
    if (config.provider === "deepseek") {
        return new DeepSeekModelExecutionBackend(config);
    }
    throw new Error(`Unsupported real LLM provider: ${String(config.provider)}`);
}
function validateRealProviderConfig(config, provider) {
    if (!config.apiKey) {
        throw new Error(`API key is required for real provider "${provider}".`);
    }
    if (!config.model) {
        throw new Error(`Model is required for real provider "${provider}".`);
    }
}
function buildOpenAiChatCompletionsUrl(config) {
    const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}
function buildDeepSeekChatCompletionsUrl(config) {
    const baseUrl = config.baseUrl ?? "https://api.deepseek.com/v1";
    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}
