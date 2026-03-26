import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MemoryEntry } from "../runtime/agent-runtime-types.js";
import { resolveMemoryPath } from "../runtime/runtime-storage-paths.js";

export class RuntimeMemoryStore {
  constructor(private readonly workdir: string) {}

  async load(scope?: string): Promise<MemoryEntry[]> {
    if (!scope) {
      return [];
    }

    const memoryPath = resolveMemoryPath(this.workdir, scope);
    let raw: string;

    try {
      raw = await readFile(memoryPath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const parsed = JSON.parse(raw) as MemoryEntry[];
    return parsed.map((entry) => ({ ...entry }));
  }

  async save(scope: string, entries: MemoryEntry[]): Promise<void> {
    const memoryPath = resolveMemoryPath(this.workdir, scope);
    await mkdir(path.dirname(memoryPath), { recursive: true });
    await writeFile(
      memoryPath,
      `${JSON.stringify(entries.map((entry) => ({ ...entry })), null, 2)}\n`,
      "utf8",
    );
  }
}
