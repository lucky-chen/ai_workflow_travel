import type { ProviderStreamEvent, StreamEvent } from "./types.js";

export interface StreamingEventAdapter {
  adapt(event: ProviderStreamEvent): StreamEvent;
}

export class StreamingEventAdapter {
  adapt(event: ProviderStreamEvent): StreamEvent {
    return {
      content: typeof event.payload.content === "string" ? event.payload.content : "",
      done: event.payload.done === true,
      error: parseError(event.payload.error),
    };
  }
}

function parseError(value: unknown): StreamEvent["error"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const code = Reflect.get(value, "code");
  const message = Reflect.get(value, "message");
  if (typeof code !== "string" || typeof message !== "string") {
    return undefined;
  }
  return { code, message };
}
