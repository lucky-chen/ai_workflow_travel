import type { Storage } from "../data/storage.js";
import type { MemoryContext, MemorySummaryItem } from "./types.js";
import { RuntimeMemoryStore } from "./runtime-memory-store.js";

export interface RuntimeMemory {
  load(sessionId: string): Promise<MemoryContext>;
  update(sessionId: string, summaryItems: MemorySummaryItem[]): Promise<void>;
}

export function createRuntimeMemory(storage: Storage): RuntimeMemory {
  return new RuntimeMemoryStore(storage);
}
