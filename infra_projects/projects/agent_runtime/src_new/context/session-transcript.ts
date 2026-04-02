import type { Storage } from "../data/storage.js";
import type { TranscriptContext, TranscriptTurn } from "./types.js";
import { SessionTranscriptStore } from "./session-transcript-store.js";

export interface SessionTranscript {
  load(sessionId: string): Promise<TranscriptContext>;
  update(sessionId: string, turns: TranscriptTurn[]): Promise<void>;
}

export function createSessionTranscript(storage: Storage): SessionTranscript {
  return new SessionTranscriptStore(storage);
}
