import { BaseModel } from "./base-model.js";
import type { StreamingEventAdapter } from "./streaming-event-adapter.js";
import type {
  FetchLike,
  IModel,
  ModelTraceWriter,
  ModeSelection,
  ModuleRequest,
  ModuleResponse,
  ProviderStreamEvent,
  StreamEvent,
} from "./types.js";

interface DeepSeekRequestBody {
  model: string;
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
}

interface DeepSeekResponseBody {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class DeepSeekModel extends BaseModel implements IModel {
  constructor(
    private readonly modeSelection: ModeSelection,
    private readonly fetchFn: FetchLike,
    private readonly streamingAdapter: StreamingEventAdapter,
    trace?: ModelTraceWriter,
  ) {
    super(trace);
  }

  protected override async executeCore(input: ModuleRequest): Promise<ModuleResponse> {
    const requestBody = buildDeepSeekRequestBody(this.modeSelection.model!, input);
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

    const content = extractDeepSeekResponseContent(rawText);
    return {
      content,
      error: {
        code: "",
        message: "",
      },
    };
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

function buildDeepSeekRequestBody(model: string, input: ModuleRequest): DeepSeekRequestBody {
  const systemPrompt = input.systemPrompt.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const messages: DeepSeekRequestBody["messages"] = [];
  if (systemPrompt.length > 0) {
    messages.push({
      role: "system",
      content: systemPrompt.join("\n"),
    });
  }
  messages.push({
    role: "user",
    content: JSON.stringify(input.userPrompt),
  });
  return {
    model,
    messages,
  };
}

function extractDeepSeekResponseContent(rawText: string): string {
  let parsed: DeepSeekResponseBody;
  try {
    parsed = JSON.parse(rawText) as DeepSeekResponseBody;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Provider returned invalid JSON.",
      { cause: error },
    );
  }
  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider response did not include choices[0].message.content.");
  }
  return content;
}

export function validateModeSelection(modeSelection: ModeSelection): void {
  if (!modeSelection.url || !modeSelection.key || !modeSelection.model) {
    throw new Error("Mode selection must include url, key, and model for non-mock model creation.");
  }
}

export function getFetchOverride(mockInfo?: Record<string, unknown>): FetchLike {
  const candidate = mockInfo?.fetchFn;
  if (typeof candidate === "function") {
    return candidate as FetchLike;
  }
  return fetch as FetchLike;
}
