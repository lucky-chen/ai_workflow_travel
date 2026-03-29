import type { AgentContext, TranscriptTurn } from "../context/types.js";
import type { ModuleResponse } from "../model/types.js";
import type { AgentRuntimeResult } from "./types.js";

export type RuntimeBoundAgentContext = AgentContext & {
  runtimeContext: NonNullable<AgentContext["runtimeContext"]>;
};

export function requireRuntimeBoundContext(context: AgentContext): RuntimeBoundAgentContext {
  if (!context.runtimeContext) {
    throw new Error("Agent runtime context is missing.");
  }
  return context as RuntimeBoundAgentContext;
}

export function getRuntimeContext(context: AgentContext): RuntimeBoundAgentContext["runtimeContext"] {
  return requireRuntimeBoundContext(context).runtimeContext;
}

export function createUserTranscriptTurn(
  context: AgentContext,
): AgentRuntimeResult["stateUpdate"]["transcriptAppend"][number] {
  return {
    role: "user",
    content: stringifyContent(getRuntimeContext(context).userInput.content),
    timestamp: new Date().toISOString(),
  };
}

export function createBaseTranscript(
  context: AgentContext,
): AgentRuntimeResult["stateUpdate"]["transcriptAppend"] {
  return [createUserTranscriptTurn(context)];
}

export function createToolTranscriptTurn(
  content: string,
): AgentRuntimeResult["stateUpdate"]["transcriptAppend"][number] {
  return {
    role: "tool",
    content,
    timestamp: new Date().toISOString(),
  };
}

export function createAssistantTranscriptTurn(
  content: string | Record<string, unknown>,
): AgentRuntimeResult["stateUpdate"]["transcriptAppend"][number] {
  return {
    role: "assistant",
    content: stringifyContent(content),
    timestamp: new Date().toISOString(),
  };
}

export function ensureSuccessfulModelResponse(response: ModuleResponse): void {
  if (response.error.code) {
    throw new Error(response.error.message || response.error.code);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function tryParseJsonRecord(content: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function contentIncludesToolHint(content: string, toolName: string): boolean {
  const normalizedContent = content.toLowerCase();
  return normalizedContent.includes(`[tool:${toolName.toLowerCase()}]`)
    || normalizedContent.includes(`use ${toolName.toLowerCase()}`)
    || normalizedContent.includes(toolName.toLowerCase());
}

export function stringifyContent(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

export function getRequestedToolName(context: AgentContext): string | undefined {
  return typeof getRuntimeContext(context).userInput.content.toolName === "string"
    ? String(getRuntimeContext(context).userInput.content.toolName)
    : undefined;
}

export function cloneTranscriptTurns(turns: TranscriptTurn[]): TranscriptTurn[] {
  return turns.map((turn) => ({ ...turn }));
}
