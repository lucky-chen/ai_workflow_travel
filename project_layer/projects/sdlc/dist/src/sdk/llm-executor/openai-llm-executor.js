import { HttpJsonClient } from "./http-json-client.js";
export class OpenAiLlmExecutor {
    config;
    httpClient;
    constructor(config) {
        this.config = config;
        this.httpClient = new HttpJsonClient(config.fetchFn);
    }
    async execute(request) {
        validateRealProviderConfig(this.config, "openai");
        const response = await this.httpClient.postJson(buildChatCompletionsUrl(this.config), {
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
function validateRealProviderConfig(config, provider) {
    if (!config.apiKey) {
        throw new Error(`API key is required for real provider "${provider}".`);
    }
    if (!config.model) {
        throw new Error(`Model is required for real provider "${provider}".`);
    }
}
function buildChatCompletionsUrl(config) {
    const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}
