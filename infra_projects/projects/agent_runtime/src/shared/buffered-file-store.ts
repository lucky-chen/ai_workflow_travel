import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export abstract class BufferedFileStore<T> {
  private readonly cache = new Map<string, T>();
  private readonly dirtyKeys = new Set<string>();
  private pendingWriteCount = 0;

  constructor(private readonly flushThreshold = 3) {}

  protected async loadBuffered(key: string): Promise<T> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return this.cloneValue(cached);
    }

    const loaded = await this.readFromFile(key);
    this.cache.set(key, this.cloneValue(loaded));
    return this.cloneValue(loaded);
  }

  protected async saveBuffered(key: string, value: T): Promise<void> {
    this.cache.set(key, this.cloneValue(value));
    if (!this.dirtyKeys.has(key)) {
      this.dirtyKeys.add(key);
    }
    this.pendingWriteCount += 1;
  }

  protected shouldFlushByThreshold(): boolean {
    return this.pendingWriteCount >= this.flushThreshold;
  }

  protected getBufferedValue(key: string): T | undefined {
    const value = this.cache.get(key);
    return value === undefined ? undefined : this.cloneValue(value);
  }

  protected async flushBuffered(key?: string): Promise<void> {
    const keys = key ? [key] : Array.from(this.dirtyKeys);
    if (keys.length === 0) {
      return;
    }

    for (const currentKey of keys) {
      const value = this.cache.get(currentKey);
      if (value === undefined) {
        this.dirtyKeys.delete(currentKey);
        continue;
      }

      const outputPath = this.resolvePath(currentKey);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, this.serialize(value), "utf8");
      this.dirtyKeys.delete(currentKey);
    }

    if (this.dirtyKeys.size === 0) {
      this.pendingWriteCount = 0;
    } else if (key) {
      this.pendingWriteCount = Math.max(0, this.pendingWriteCount - 1);
    } else {
      this.pendingWriteCount = 0;
    }
  }

  private async readFromFile(key: string): Promise<T> {
    const inputPath = this.resolvePath(key);
    let raw: string;

    try {
      raw = await readFile(inputPath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return this.emptyValue();
      }
      throw error;
    }

    return this.parse(raw);
  }

  protected abstract resolvePath(key: string): string;
  protected abstract emptyValue(): T;
  protected abstract parse(raw: string): T;
  protected abstract serialize(value: T): string;
  protected abstract cloneValue(value: T): T;
}
