import type {
  IModelBackend,
  ModelBackendRequest,
  ModelBackendResult,
} from "../runtime/agent-runtime.js";
import { HttpJsonClient } from "./http-json-client.js";
import type { RealProviderConfig } from "./real-provider-config.js";

export type ModelExecutionMode = "mock" | "real";

export interface ModelExecutionDependencies {
  mode?: ModelExecutionMode;
  mockContent?: string;
  mockExecute?: (request: ModelBackendRequest) => Promise<ModelBackendResult> | ModelBackendResult;
  realProvider?: RealProviderConfig;
}

export interface ExecutionStrategy {
  mode: ModelExecutionMode;
  executor: IModelBackend;
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
      executor: new MockModelExecutionBackend(dependencies.mockContent, dependencies.mockExecute),
    };
  }
}

export class MockModelExecutionBackend implements IModelBackend {
  constructor(
    private readonly mockContent?: string,
    private readonly mockExecute?: (request: ModelBackendRequest) => Promise<ModelBackendResult> | ModelBackendResult,
  ) {}

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (this.mockExecute) {
      return this.mockExecute(request);
    }

    return {
      content:
        this.mockContent ??
        JSON.stringify({
          summary: "Mock implementation change set",
          changed_files: [],
          request_preview: JSON.stringify(request.prompt.userPrompt).slice(0, 200),
        }),
      responseFormat: request.responseFormat,
      metadata: request.metadata,
    };
  }
}

export class OpenAiModelExecutionBackend implements IModelBackend {
  private readonly httpClient: HttpJsonClient;

  constructor(private readonly config: RealProviderConfig) {
    this.httpClient = new HttpJsonClient(config.fetchFn);
  }

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
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
          { role: "system", content: request.prompt.systemPrompt.join("\n") },
          { role: "user", content: JSON.stringify(request.prompt.userPrompt) },
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

export class DeepSeekModelExecutionBackend implements IModelBackend {
  private readonly httpClient: HttpJsonClient;

  constructor(private readonly config: RealProviderConfig) {
    this.httpClient = new HttpJsonClient(config.fetchFn);
  }

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
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
          { role: "system", content: request.prompt.systemPrompt.join("\n") },
          { role: "user", content: JSON.stringify(request.prompt.userPrompt) },
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

function createRealProviderExecutor(config: RealProviderConfig = {}): IModelBackend {
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
