import type {
  IModelExecutionBackend,
  LlmExecutionRequest,
  LlmExecutionResult,
} from "../runtime/agent-runtime.js";
import { HttpJsonClient } from "./http-json-client.js";
import type { RealProviderConfig } from "./real-provider-config.js";

export type ModelExecutionMode = "mock" | "real";

export interface ModelExecutionDependencies {
  mode?: ModelExecutionMode;
  mockContent?: string;
  realProvider?: RealProviderConfig;
}

export interface ExecutionStrategy {
  mode: ModelExecutionMode;
  executor: IModelExecutionBackend;
}

export class ExecutionStrategySelector {
  select(dependencies: ModelExecutionDependencies = {}): ExecutionStrategy {
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

export class MockModelExecutionBackend implements IModelExecutionBackend {
  constructor(private readonly mockContent?: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content:
        this.mockContent ??
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

export class OpenAiModelExecutionBackend implements IModelExecutionBackend {
  private readonly httpClient: HttpJsonClient;

  constructor(private readonly config: RealProviderConfig) {
    this.httpClient = new HttpJsonClient(config.fetchFn);
  }

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    validateRealProviderConfig(this.config, "openai");

    const response = await this.httpClient.postJson<
      {
        model: string;
        messages: Array<{ role: "system" | "user"; content: string }>;
      },
      ChatCompletionsResponse
    >(buildOpenAiChatCompletionsUrl(this.config), {
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
      throw new Error("OpenAI response did not include choices[0].message.content.");
    }

    return {
      content,
      responseFormat: request.responseFormat,
      metadata: request.metadata,
    };
  }
}

export class DeepSeekModelExecutionBackend implements IModelExecutionBackend {
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
    >(buildDeepSeekChatCompletionsUrl(this.config), {
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

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function createRealProviderExecutor(config: RealProviderConfig = {}): IModelExecutionBackend {
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

function validateRealProviderConfig(config: RealProviderConfig, provider: "openai" | "deepseek"): void {
  if (!config.apiKey) {
    throw new Error(`API key is required for real provider "${provider}".`);
  }

  if (!config.model) {
    throw new Error(`Model is required for real provider "${provider}".`);
  }
}

function buildOpenAiChatCompletionsUrl(config: RealProviderConfig): string {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function buildDeepSeekChatCompletionsUrl(config: RealProviderConfig): string {
  const baseUrl = config.baseUrl ?? "https://api.deepseek.com/v1";
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}
