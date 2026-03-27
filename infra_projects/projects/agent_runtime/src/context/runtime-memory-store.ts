import type { MemoryEntry } from "../runtime/agent-runtime-types.js";
import { resolveMemoryPath } from "../runtime/runtime-storage-paths.js";
import { BufferedFileStore } from "../shared/buffered-file-store.js";

export class RuntimeMemoryStore extends BufferedFileStore<MemoryEntry[]> {
  constructor(private readonly workdir: string, flushThreshold = 3) {
    super(flushThreshold);
  }

  async load(scope?: string): Promise<MemoryEntry[]> {
    if (!scope) {
      return [];
    }
    return this.loadBuffered(scope);
  }

  async save(scope: string, entries: MemoryEntry[]): Promise<void> {
    await this.saveBuffered(scope, entries);
    if (this.shouldFlushByThreshold()) {
      await this.flush();
    }
  }

  async flush(scope?: string): Promise<void> {
    await this.flushBuffered(scope);
  }

  protected resolvePath(scope: string): string {
    return resolveMemoryPath(this.workdir, scope);
  }

  protected emptyValue(): MemoryEntry[] {
    return [];
  }

  protected parse(raw: string): MemoryEntry[] {
    return (JSON.parse(raw) as MemoryEntry[]).map((entry) => ({ ...entry }));
  }

  protected serialize(value: MemoryEntry[]): string {
    return `${JSON.stringify(this.cloneValue(value), null, 2)}\n`;
  }

  protected cloneValue(value: MemoryEntry[]): MemoryEntry[] {
    return value.map((entry) => ({ ...entry }));
  }
}
