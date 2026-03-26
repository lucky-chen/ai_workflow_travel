import type {
  IModelBackend,
  ModelBackendRequest,
  ModelBackendResult,
  ModelTraceFacts,
} from "../runtime/agent-runtime.js";
import { ProviderExecutionError } from "../runtime/provider-execution-error.js";
import { createTracePreview } from "../runtime/trace-preview.js";
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

    if (request.mode === "planning") {
      const originalTask = asRecord(request.prompt.userPrompt.originalTask);
      const requestedFormat = request.prompt.userPrompt.responseFormat;
      const intent = requestedFormat === "json" && inferMockPlanningIntent(originalTask) === "chat"
        ? "chat"
        : inferMockPlanningIntent(originalTask);
      const mode = intent === "task"
        && Array.isArray(request.prompt.userPrompt.availableTools)
        && request.prompt.userPrompt.availableTools.length > 0
        ? "tool_augmented_generation"
        : "direct_generation";
      const content = JSON.stringify({
        intent,
        mode,
        summary: "Mock planning result.",
        stepIndex: 1,
        nextStepGoal: "Generate runtime output.",
      });
      return {
        content,
        responseFormat: "json",
        traceFacts: buildMockTraceFacts(request, "json", content),
        metadata: request.metadata,
      };
    }

    if (request.responseFormat === "json" && request.prompt.userPrompt.intent === "chat") {
      const content = this.mockContent ?? JSON.stringify({ answer: "Mock chat answer." });
      return {
        content,
        responseFormat: "json",
        traceFacts: buildMockTraceFacts(request, "json", content),
        metadata: request.metadata,
      };
    }

    const content =
      this.mockContent ??
      JSON.stringify({
        summary: "Mock implementation change set",
        changed_files: [],
        request_preview: JSON.stringify(request.prompt.userPrompt).slice(0, 200),
      });
    return {
      content,
      responseFormat: request.responseFormat,
      traceFacts: buildMockTraceFacts(request, request.responseFormat, content),
      metadata: request.metadata,
    };
  }
}

function inferMockPlanningIntent(task: Record<string, unknown>): "chat" | "task" {
  const text = JSON.stringify(task).toLowerCase();
  return /tool|file|write|read|change|edit/.test(text) ? "task" : "chat";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export class OpenAiModelExecutionBackend implements IModelBackend {
  private readonly httpClient: HttpJsonClient;

  constructor(private readonly config: RealProviderConfig) {
    this.httpClient = new HttpJsonClient(config.fetchFn);
  }

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    validateRealProviderConfig(this.config, "openai");
    const url = buildOpenAiChatCompletionsUrl(this.config);
    const requestBody = buildChatCompletionsRequestBody(this.config.model!, request);
    const response = await this.postChatCompletions(url, requestBody);
    const content = extractChatCompletionContent(
      response.data,
      "OpenAI response did not include choices[0].message.content.",
    );

    return {
      content,
      responseFormat: request.responseFormat,
      traceFacts: buildRealTraceFacts("openai", this.config, request, requestBody, response, content),
      metadata: request.metadata,
    };
  }

  private postChatCompletions(url: string, body: ChatCompletionsRequest) {
    return postChatCompletions(this.httpClient, this.config, url, body);
  }
}

export class DeepSeekModelExecutionBackend implements IModelBackend {
  private readonly httpClient: HttpJsonClient;

  constructor(private readonly config: RealProviderConfig) {
    this.httpClient = new HttpJsonClient(config.fetchFn);
  }

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    validateRealProviderConfig(this.config, "deepseek");
    const url = buildDeepSeekChatCompletionsUrl(this.config);
    const requestBody = buildChatCompletionsRequestBody(this.config.model!, request);
    const response = await this.postChatCompletions(url, requestBody);
    const content = extractChatCompletionContent(
      response.data,
      "DeepSeek response did not include choices[0].message.content.",
    );

    return {
      content,
      responseFormat: request.responseFormat,
      traceFacts: buildRealTraceFacts("deepseek", this.config, request, requestBody, response, content),
      metadata: request.metadata,
    };
  }

  private postChatCompletions(url: string, body: ChatCompletionsRequest) {
    return postChatCompletions(this.httpClient, this.config, url, body);
  }
}

function postChatCompletions(
  httpClient: HttpJsonClient,
  config: RealProviderConfig,
  url: string,
  body: ChatCompletionsRequest,
) {
  return httpClient.postJsonDetailed<ChatCompletionsRequest, ChatCompletionsResponse>(url, {
    headers: {
      authorization: `Bearer ${config.apiKey}`,
    },
    body,
    timeoutMs: config.timeoutMs,
  }).catch((error: unknown) => {
    throw classifyProviderError(error);
  });
}

interface ChatCompletionsRequest {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
}

interface ChatCompletionsResponse {
  usage?: Record<string, number>;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
}

function buildChatCompletionsRequestBody(
  model: string,
  request: ModelBackendRequest,
): ChatCompletionsRequest {
  return {
    model,
    messages: [
      { role: "system", content: request.prompt.systemPrompt.join("\n") },
      { role: "user", content: JSON.stringify(request.prompt.userPrompt) },
    ],
  };
}

function extractChatCompletionContent(
  response: ChatCompletionsResponse,
  errorMessage: string,
): string {
  if (!Array.isArray(response.choices)) {
    throw new ProviderExecutionError("provider_response_shape_invalid", errorMessage);
  }

  if (response.choices.length === 0) {
    throw new ProviderExecutionError("provider_empty_response", errorMessage);
  }

  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ProviderExecutionError("provider_response_shape_invalid", errorMessage);
  }

  if (!content.trim()) {
    throw new ProviderExecutionError("provider_empty_response", errorMessage);
  }

  return content;
}

function classifyProviderError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ProviderExecutionError("provider_malformed_output", error.message);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/aborted|timeout/i.test(message)) {
    return new ProviderExecutionError("provider_timeout", message);
  }
  if (/HTTP request failed/i.test(message)) {
    return new ProviderExecutionError("provider_contract_violation", message);
  }

  return new ProviderExecutionError("provider_transport_error", message);
}

function buildMockTraceFacts(
  request: ModelBackendRequest,
  responseFormat: "text" | "json",
  content: string,
): ModelTraceFacts {
  return {
    requestType: request.mode,
    provider: "mock",
    responseFormat,
    systemPromptPreview: createTracePreview(request.prompt.systemPrompt.join("\n")),
    userPromptPreview: createTracePreview(request.prompt.userPrompt),
    requestBodyPreview: createTracePreview(request.prompt.userPrompt),
    rawResponsePreview: createTracePreview(content),
    parsedContentPreview: createTracePreview(content),
    responseShape: "mock_content",
  };
}

function buildRealTraceFacts(
  provider: "openai" | "deepseek",
  config: RealProviderConfig,
  request: ModelBackendRequest,
  requestBody: ChatCompletionsRequest,
  response: { status: number; rawText: string; data: ChatCompletionsResponse },
  content: string,
): ModelTraceFacts {
  return {
    requestType: request.mode,
    provider,
    model: config.model,
    timeoutMs: config.timeoutMs,
    httpStatus: response.status,
    responseFormat: request.responseFormat,
    systemPromptPreview: createTracePreview(request.prompt.systemPrompt.join("\n")),
    userPromptPreview: createTracePreview(request.prompt.userPrompt),
    requestBodyPreview: createTracePreview(requestBody),
    rawResponsePreview: createTracePreview(response.rawText),
    parsedContentPreview: createTracePreview(content),
    finishReason: response.data.choices?.[0]?.finish_reason,
    usage: response.data.usage,
    responseShape: Array.isArray(response.data.choices) ? "chat_completions" : "invalid",
  };
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
