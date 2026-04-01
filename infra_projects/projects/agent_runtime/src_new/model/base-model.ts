import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";
import type {
  IModel,
  ModuleRequest,
  ModuleResponse,
  StreamEvent,
} from "./types.js";

export abstract class BaseModel implements IModel {
  protected running = false;

  constructor(protected readonly eventBus?: RuntimeEventBus) {}

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
    if (!this.eventBus || !input.runtimeEvent) {
      return;
    }
    const event = {
      type: "model" as const,
      modelMessage: {
        event: type,
        timestamp: new Date().toISOString(),
        sessionId: input.runtimeEvent.sessionId,
        traceId: input.runtimeEvent.traceId,
        agent: input.runtimeEvent.agent,
        request: {
          responseFormat: input.responseFormat,
          userPrompt: input.userPrompt,
          stream: input.stream,
          systemPromptCount: input.systemPrompt.length,
        },
        response,
      },
    };
    await this.eventBus.publish(event);
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
