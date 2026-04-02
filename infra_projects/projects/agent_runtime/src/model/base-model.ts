import type {
  IModel,
  ModelTraceWriter,
  ModuleRequest,
  ModuleResponse,
  StreamEvent,
} from "./types.js";

export abstract class BaseModel implements IModel {
  protected running = false;

  constructor(protected readonly trace?: ModelTraceWriter) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    await this.publishModelEvent("model_started", input);
    try {
      const response = await this.executeCore(input);
      await this.publishModelEvent("model_completed", input, response);
      return response;
    } catch (error) {
      const response = normalizeModelError(error);
      await this.publishModelEvent("model_completed", input, response);
      throw error;
    } finally {
      this.running = false;
    }
  }

  abstract stream(input: ModuleRequest): AsyncIterable<StreamEvent>;

  protected abstract executeCore(input: ModuleRequest): Promise<ModuleResponse>;

  private async publishModelEvent(
    type: "model_started" | "model_completed",
    input: ModuleRequest,
    response?: ModuleResponse,
  ): Promise<void> {
    if (!this.trace) {
      return;
    }
    await this.trace.record({
      type: "model",
      brief: type === "model_started" ? "model.call.started" : "model.call.finished",
      metadata: {
        timestamp: new Date().toISOString(),
      },
      details: omitUndefined({
        request: {
          responseFormat: input.responseFormat,
          userPrompt: input.userPrompt,
          stream: input.stream,
          systemPromptCount: input.systemPrompt.length,
        },
        response,
        error: response?.error?.code ? response.error : undefined,
      }),
    });
  }
}

function normalizeModelError(error: unknown): ModuleResponse {
  if (error && typeof error === "object" && "content" in error && "error" in error) {
    return error as ModuleResponse;
  }
  return {
    content: "",
    error: {
      code: "MODEL_CALL_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const filtered = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
