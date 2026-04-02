import type { Storage } from "../data/storage.js";

export abstract class PersistentObservabilityBuffer {
  private dirtyEntryCount = 0;
  private loadPromise: Promise<void> = Promise.resolve();

  constructor(
    protected readonly storage: Storage,
    private readonly storageKey: string,
  ) {}

  protected initializeLoading(loadPersistedState: () => Promise<void>): void {
    this.loadPromise = loadPersistedState();
  }

  protected async ensureLoaded(): Promise<void> {
    await this.loadPromise;
  }

  protected async recordMutation(shouldFlushImmediately: boolean): Promise<void> {
    this.dirtyEntryCount += 1;
    if (shouldFlushImmediately || this.dirtyEntryCount >= 3) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    await this.ensureLoaded();
    await this.storage.save(this.storageKey, this.buildPersistedPayload());
    this.dirtyEntryCount = 0;
  }

  protected async loadPersistedPayload(): Promise<Record<string, unknown> | undefined> {
    try {
      return await this.storage.load(this.storageKey);
    } catch (error) {
      if (!isMissingStorageError(error)) {
        throw error;
      }
      return undefined;
    }
  }

  protected resetDirtyEntryCount(): void {
    this.dirtyEntryCount = 0;
  }

  protected getDirtyEntryCount(): number {
    return this.dirtyEntryCount;
  }

  protected abstract buildPersistedPayload(): Record<string, unknown>;
}

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
