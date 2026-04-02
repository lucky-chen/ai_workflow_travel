import type { Storage } from "../data/storage.js";
import type { MemoryContext, MemorySummaryItem } from "./types.js";
import type { RuntimeMemory } from "./runtime-memory.js";

export class RuntimeMemoryStore implements RuntimeMemory {
  constructor(private readonly storage: Storage) {}

  async load(sessionId: string): Promise<MemoryContext> {
    try {
      const payload = await this.storage.load(memoryStorageKey(sessionId));
      return parseMemoryContext(payload, sessionId);
    } catch (error) {
      if (isMissingStorageError(error)) {
        return { summaryItems: [] };
      }
      throw error;
    }
  }

  async update(sessionId: string, summaryItems: MemorySummaryItem[]): Promise<void> {
    await this.storage.save(memoryStorageKey(sessionId), {
      summaryItems,
    });
  }
}

function parseMemoryContext(payload: Record<string, unknown>, sessionId: string): MemoryContext {
  if (!Array.isArray(payload.summaryItems)) {
    throw new Error(`Runtime memory payload for ${sessionId} is invalid.`);
  }

  const summaryItems = payload.summaryItems.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Runtime memory payload for ${sessionId} is invalid.`);
    }
    const summary = Reflect.get(item, "summary");
    const sourceTurnId = Reflect.get(item, "sourceTurnId");
    if (typeof summary !== "string") {
      throw new Error(`Runtime memory payload for ${sessionId} contains invalid summary.`);
    }
    return {
      summary,
      sourceTurnId: typeof sourceTurnId === "string" ? sourceTurnId : undefined,
    };
  });

  return { summaryItems };
}

function memoryStorageKey(sessionId: string): string {
  return `memory/${sessionId}`;
}

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
