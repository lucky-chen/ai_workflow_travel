// DeepSeek executor: maps shared LLM requests onto a DeepSeek-compatible chat completions API.
import type {
  ILlmExecutor,
  LlmExecutionRequest,
  LlmExecutionResult,
} from "../../shared/contracts/llm-executor.js";
import { HttpJsonClient } from "./http-json-client.js";
import type { RealProviderConfig } from "./real-provider-config.js";

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class DeepSeekLlmExecutor implements ILlmExecutor {
  private readonly httpClient: HttpJsonClient;

  constructor(private readonly config: RealProviderConfig) {
    this.httpClient = new HttpJsonClient(config.fetchFn);
  }

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    validateRealProviderConfig(this.config, "deepseek");

    const response = await this.httpClient.postJson<
      {
        model: string;
        messages: Array<{ role: "system" | "user"; content: string }>;
      },
      ChatCompletionsResponse
    >(buildChatCompletionsUrl(this.config), {
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: {
        model: this.config.model!,
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

function validateRealProviderConfig(config: RealProviderConfig, provider: "deepseek"): void {
  if (!config.apiKey) {
    throw new Error(`API key is required for real provider "${provider}".`);
  }

  if (!config.model) {
    throw new Error(`Model is required for real provider "${provider}".`);
  }
}

function buildChatCompletionsUrl(config: RealProviderConfig): string {
  const baseUrl = config.baseUrl ?? "https://api.deepseek.com/v1";
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}
