import {
  StreamingEventAdapter,
  type StreamingEventAdapter as StreamingEventAdapterContract,
} from "./streaming-event-adapter.js";
import type {
  FetchLike,
  FetchResponseLike,
  IModel,
  ModeSelection,
  ModelCreationInput,
  ModelFactory as ModelFactoryContract,
  ModuleRequest,
  ModuleResponse,
  ProviderStreamEvent,
  StreamEvent,
} from "./types.js";

export class ModelFactory implements ModelFactoryContract {
  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new StreamingEventAdapter());
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new HttpModel(input.modeSelection, fetchFn, new StreamingEventAdapter());
  }
}

class MockModel implements IModel {
  private running = false;

  constructor(
    private readonly mockInfo: Record<string, unknown> | undefined,
    private readonly streamingAdapter: StreamingEventAdapterContract,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(_input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    try {
      const resolvedContent = resolveMockContent(this.mockInfo, _input);
      return {
        content: resolvedContent,
        error: {
          code: "",
          message: "",
        },
      };
    } finally {
      this.running = false;
    }
  }

  async *stream(input: ModuleRequest): AsyncIterable<StreamEvent> {
    const response = await this.execute(input);
    yield this.streamingAdapter.adapt({
      payload: {
        content: response.content,
        done: true,
      },
    });
  }
}

function resolveMockContent(mockInfo: Record<string, unknown> | undefined, input: ModuleRequest): string {
  const responder = mockInfo?.respond;
  if (typeof responder === "function") {
    const resolved = responder(input.prompt, input);
    return typeof resolved === "string" ? resolved : JSON.stringify(resolved ?? { ok: true });
  }

  const stage = isRecord(input.prompt) && typeof input.prompt.stage === "string"
    ? input.prompt.stage
    : undefined;
  const responses = isRecord(mockInfo?.responses) ? mockInfo?.responses : undefined;
  if (stage && responses && typeof responses[stage] === "string") {
    return String(responses[stage]);
  }

  if (typeof mockInfo?.content === "string") {
    return mockInfo.content;
  }

  return JSON.stringify(mockInfo ?? { ok: true });
}

class HttpModel implements IModel {
  private running = false;

  constructor(
    private readonly modeSelection: ModeSelection,
    private readonly fetchFn: FetchLike,
    private readonly streamingAdapter: StreamingEventAdapterContract,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    try {
      const requestBody = buildProviderRequestBody(this.modeSelection, input);
      const response = await this.fetchFn(this.modeSelection.url!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.modeSelection.key!}`,
        },
        body: JSON.stringify(requestBody),
      });
      const rawText = await response.text();
      if (!response.ok) {
        return {
          content: "",
          error: {
            code: "MODEL_HTTP_ERROR",
            message: rawText,
          },
        };
      }

      const content = extractResponseContent(rawText);
      return {
        content,
        error: {
          code: "",
          message: "",
        },
      };
    } finally {
      this.running = false;
    }
  }

  async *stream(input: ModuleRequest): AsyncIterable<StreamEvent> {
    const response = await this.execute(input);
    const event: ProviderStreamEvent = {
      payload: {
        content: response.content,
        done: true,
        error: response.error.code
          ? response.error
          : undefined,
      },
    };
    yield this.streamingAdapter.adapt(event);
  }
}

function validateModeSelection(modeSelection: ModeSelection): void {
  if (!modeSelection.url || !modeSelection.key || !modeSelection.model) {
    throw new Error("Mode selection must include url, key, and model for non-mock model creation.");
  }
}

function buildProviderRequestBody(modeSelection: ModeSelection, input: ModuleRequest): Record<string, unknown> {
  return {
    model: modeSelection.model,
    messages: buildMessages(input.prompt),
    stream: input.stream,
  };
}

function buildMessages(prompt: Record<string, unknown>): Array<{ role: string; content: string }> {
  const transcript = prompt.transcript;
  if (Array.isArray(transcript) && transcript.length > 0) {
    const messages = transcript
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        role: normalizeMessageRole(Reflect.get(item, "role")),
        content: typeof Reflect.get(item, "content") === "string"
          ? String(Reflect.get(item, "content"))
          : JSON.stringify(item),
      }));

    const userInput = isRecord(prompt.userInput) ? prompt.userInput : undefined;
    if (userInput) {
      messages.push({
        role: "user",
        content: JSON.stringify(userInput),
      });
    }
    return messages;
  }

  return [
    {
      role: "user",
      content: JSON.stringify(prompt),
    },
  ];
}

function normalizeMessageRole(role: unknown): string {
  if (role === "system" || role === "assistant" || role === "user") {
    return role;
  }
  if (role === "tool") {
    return "assistant";
  }
  return "user";
}

function getFetchOverride(mockInfo?: Record<string, unknown>): FetchLike {
  const candidate = mockInfo?.fetchFn;
  if (typeof candidate === "function") {
    return candidate as FetchLike;
  }
  return fetch as FetchLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractResponseContent(rawText: string): string {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (typeof parsed.content === "string") {
    return parsed.content;
  }

  const choices = parsed.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const message = Reflect.get(firstChoice, "message");
      if (message && typeof message === "object") {
        const content = Reflect.get(message, "content");
        if (typeof content === "string") {
          return content;
        }
      }
    }
  }

  throw new Error("Provider response does not contain supported content.");
}
