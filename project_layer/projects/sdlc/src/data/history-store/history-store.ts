import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FilePath, StageId, TaskId, TraceRef } from "../../shared/types/common.js";

export interface HistoryRecord {
  recordId?: TraceRef;
  category: string;
  taskId?: TaskId;
  stageId?: StageId;
  summary?: string;
  payload: Record<string, unknown>;
}

export interface HistoryQuery {
  category?: string;
  taskId?: TaskId;
  stageId?: StageId;
}

export class HistoryStoreService {
  constructor(private readonly storageRoot: string = path.resolve(process.cwd(), "history_store")) {}

  async writeRecord(record: HistoryRecord): Promise<TraceRef> {
    const recordId = record.recordId ?? `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetPath = path.join(this.storageRoot, "records", `${recordId}.json`);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(
      targetPath,
      JSON.stringify(
        {
          ...record,
          recordId,
        },
        null,
        2,
      ),
      "utf8",
    );

    return recordId;
  }

  async getRecord(recordId: TraceRef): Promise<HistoryRecord> {
    const targetPath = path.join(this.storageRoot, "records", `${recordId}.json`);
    const raw = await readFile(targetPath, "utf8");
    return JSON.parse(raw) as HistoryRecord;
  }

  async listRecords(query: HistoryQuery = {}): Promise<HistoryRecord[]> {
    const recordsDirectory = path.join(this.storageRoot, "records");
    let entries: string[];

    try {
      entries = await readdir(recordsDirectory);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const records = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map(async (entry) => {
          const raw = await readFile(path.join(recordsDirectory, entry as FilePath), "utf8");
          return JSON.parse(raw) as HistoryRecord;
        }),
    );

    return records.filter((record) => {
      if (query.category && record.category !== query.category) {
        return false;
      }

      if (query.taskId && record.taskId !== query.taskId) {
        return false;
      }

      if (query.stageId && record.stageId !== query.stageId) {
        return false;
      }

      return true;
    });
  }
}
