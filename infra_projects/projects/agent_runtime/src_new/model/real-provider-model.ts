import type { StreamingEventAdapter } from "./streaming-event-adapter.js";
import type {
  FetchLike,
  IModel,
  ModeSelection,
  ModuleRequest,
  ModuleResponse,
  ProviderStreamEvent,
  StreamEvent,
} from "./types.js";

export class RealProviderModel implements IModel {
  private running = false;

  constructor(
    private readonly modeSelection: ModeSelection,
    private readonly fetchFn: FetchLike,
    private readonly streamingAdapter: StreamingEventAdapter,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    try {
      const response = await this.fetchFn(this.modeSelection.url!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.modeSelection.key!}`,
        },
        body: JSON.stringify(input.prompt),
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

      return {
        content: rawText,
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
