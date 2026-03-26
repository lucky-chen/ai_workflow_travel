import type { TracePreview } from "./agent-runtime-types.js";

const DEFAULT_PREVIEW_LIMIT = 400;

export function createTracePreview(value: unknown, limit = DEFAULT_PREVIEW_LIMIT): TracePreview {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) {
    return {
      text: "",
      truncated: false,
    };
  }

  return {
    text: text.slice(0, limit),
    truncated: text.length > limit,
  };
}
