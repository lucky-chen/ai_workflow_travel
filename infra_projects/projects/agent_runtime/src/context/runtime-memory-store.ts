import type { MemoryEntry } from "../runtime/agent-runtime-types.js";

export class RuntimeMemoryStore {
  private readonly scopedMemory = new Map<string, MemoryEntry[]>();

  async load(scope?: string): Promise<MemoryEntry[]> {
    if (!scope) {
      return [];
    }

    return (this.scopedMemory.get(scope) ?? []).map((entry) => ({ ...entry }));
  }

  async save(scope: string, entries: MemoryEntry[]): Promise<void> {
    this.scopedMemory.set(scope, entries.map((entry) => ({ ...entry })));
  }
}
