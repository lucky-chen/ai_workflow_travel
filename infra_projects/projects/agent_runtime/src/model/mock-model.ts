import { BaseModel } from "./base-model.js";
import type { StreamingEventAdapter } from "./streaming-event-adapter.js";
import type {
  IModel,
  ModelTraceWriter,
  ModuleRequest,
  ModuleResponse,
  StreamEvent,
} from "./types.js";

export class MockModel extends BaseModel implements IModel {
  constructor(
    private readonly mockInfo: Record<string, unknown> | undefined,
    private readonly streamingAdapter: StreamingEventAdapter,
    trace?: ModelTraceWriter,
  ) {
    super(trace);
  }

  protected override executeCore(input: ModuleRequest): Promise<ModuleResponse> {
    const resolvedContent = resolveMockContent(this.mockInfo, input);
    return Promise.resolve({
      content: resolvedContent,
      error: {
        code: "",
        message: "",
      },
    });
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
  const responder = typeof mockInfo?.respond === "function"
    ? mockInfo.respond as (userPrompt: ModuleRequest["userPrompt"], request: ModuleRequest) => unknown
    : undefined;
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
