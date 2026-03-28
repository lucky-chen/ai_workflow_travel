import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Storage {
  load(storageKey: string): Promise<Record<string, unknown>>;
  save(storageKey: string, payload: Record<string, unknown>): Promise<void>;
}

export class FileStorage implements Storage {
  constructor(private readonly rootDir: string) {}

  async load(storageKey: string): Promise<Record<string, unknown>> {
    const filePath = this.resolvePath(storageKey);
    const raw = await readFile(filePath, "utf8");
    return parseStoragePayload(raw, storageKey);
  }

  async save(storageKey: string, payload: Record<string, unknown>): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  private resolvePath(storageKey: string): string {
    return path.join(this.rootDir, `${storageKey}.json`);
  }
}

function parseStoragePayload(raw: string, storageKey: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Storage payload for ${storageKey} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

