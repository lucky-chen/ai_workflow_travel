import type { StreamingEventAdapter } from "./streaming-event-adapter.js";
import type {
  IModel,
  ModuleRequest,
  ModuleResponse,
  StreamEvent,
} from "./types.js";

export class MockModel implements IModel {
  private running = false;

  constructor(
    private readonly mockInfo: Record<string, unknown> | undefined,
    private readonly streamingAdapter: StreamingEventAdapter,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    try {
      const resolvedContent = resolveMockContent(this.mockInfo, input);
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
    const resolved = responder(input.userPrompt, input);
    return typeof resolved === "string" ? resolved : JSON.stringify(resolved ?? { ok: true });
  }

  const userPrompt = isRecord(input.userPrompt) ? input.userPrompt : undefined;
  const stage = typeof userPrompt?.stage === "string" ? userPrompt.stage : undefined;
  const responses = isRecord(mockInfo?.responses) ? mockInfo?.responses : undefined;
  if (stage && responses && typeof responses[stage] === "string") {
    return String(responses[stage]);
  }

  if (typeof mockInfo?.content === "string") {
    return mockInfo.content;
  }

  return JSON.stringify(mockInfo ?? { ok: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
