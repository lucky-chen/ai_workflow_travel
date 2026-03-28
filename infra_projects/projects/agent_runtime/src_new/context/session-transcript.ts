import type { Storage } from "../data/storage.js";
import type { TranscriptContext, TranscriptTurn } from "./types.js";

export interface SessionTranscript {
  load(sessionId: string): Promise<TranscriptContext>;
  update(sessionId: string, turns: TranscriptTurn[]): Promise<void>;
}

export class StorageBackedSessionTranscript implements SessionTranscript {
  constructor(private readonly storage: Storage) {}

  async load(sessionId: string): Promise<TranscriptContext> {
    try {
      const payload = await this.storage.load(transcriptStorageKey(sessionId));
      return parseTranscriptContext(payload, sessionId);
    } catch (error) {
      if (isMissingStorageError(error)) {
        return { turns: [] };
      }
      throw error;
    }
  }

  async update(sessionId: string, turns: TranscriptTurn[]): Promise<void> {
    await this.storage.save(transcriptStorageKey(sessionId), {
      turns,
    });
  }
}

function parseTranscriptContext(payload: Record<string, unknown>, sessionId: string): TranscriptContext {
  if (!Array.isArray(payload.turns)) {
    throw new Error(`Transcript payload for ${sessionId} is invalid.`);
  }

  const turns = payload.turns.map((turn) => {
    if (!turn || typeof turn !== "object") {
      throw new Error(`Transcript payload for ${sessionId} is invalid.`);
    }
    const role = Reflect.get(turn, "role");
    const content = Reflect.get(turn, "content");
    const timestamp = Reflect.get(turn, "timestamp");
    if (
      role !== "user" &&
      role !== "assistant" &&
      role !== "system" &&
      role !== "tool"
    ) {
      throw new Error(`Transcript payload for ${sessionId} contains invalid role.`);
    }
    if (typeof content !== "string") {
      throw new Error(`Transcript payload for ${sessionId} contains invalid content.`);
    }

    return {
      role,
      content,
      timestamp: typeof timestamp === "string" ? timestamp : undefined,
    };
  });

  return { turns };
}

function transcriptStorageKey(sessionId: string): string {
  return `transcripts/${sessionId}`;
}

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

