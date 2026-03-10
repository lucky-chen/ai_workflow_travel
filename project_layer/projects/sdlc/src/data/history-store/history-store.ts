import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FilePath, StageId, TaskId, TraceRef } from "../../shared/types/common.js";

export interface HistoryRecord {
  recordId?: TraceRef;
  category: string;
  caller?: string;
  scope?: {
    taskId: TaskId;
    runId: string;
    stageId: StageId | null;
  };
  summary?: string;
  payload: Record<string, unknown>;
}

export interface HistoryQuery {
  category?: string;
  taskId?: TaskId;
  stageId?: StageId;
}

export interface HistoryTaskContext {
  workspaceRoot?: string;
  runId?: string;
}

export type HistoryWorkspaceRootResolver = (taskId: TaskId) => string | HistoryTaskContext | undefined;

export class HistoryStoreService {
  constructor(
    private readonly storageRoot?: string,
    private readonly workspaceRootResolver?: HistoryWorkspaceRootResolver,
  ) {}

  async writeRecord(record: HistoryRecord): Promise<TraceRef> {
    const recordId = record.recordId ?? `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const taskId = this.requireTaskId(record.scope?.taskId);
    const resolvedTaskContext = this.resolveTaskContext(taskId);
    const runId = this.requireRunId(this.normalizeOptionalIdentifier(record.scope?.runId) ?? resolvedTaskContext.runId);
    const stageId = this.normalizeOptionalIdentifier(record.scope?.stageId);
    const storageRoot = this.resolveStorageRoot(resolvedTaskContext.workspaceRoot);
    const persistedRecord: HistoryRecord = {
      ...record,
      scope: this.buildScope(taskId, runId, stageId),
      recordId,
    };
    const taskBucketName = this.resolveTaskBucketName(taskId, runId);
    const targetPath = path.join(storageRoot, "records", `${taskBucketName}.json`);
    const updatedBucket = await this.readBucket(targetPath);
    updatedBucket.push(persistedRecord);
    await this.writeBucket(targetPath, updatedBucket);

    return recordId;
  }

  async getRecord(recordId: TraceRef): Promise<HistoryRecord> {
    const records = await this.listRecords();
    const record = records.find((entry) => entry.recordId === recordId);
    if (!record) {
      const error = new Error(`History record "${recordId}" not found.`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return record;
  }

  async listRecords(query: HistoryQuery = {}): Promise<HistoryRecord[]> {
    const recordsDirectory = path.join(this.resolveStorageRoot(), "records");
    const recordFiles = await this.listRecordFiles(recordsDirectory);
    const records = await Promise.all(
      recordFiles.map(async (entry) => {
        const raw = await readFile(entry, "utf8");
        return JSON.parse(raw) as HistoryRecord[];
      }),
    );

    return records.flat().filter((record) => {
      if (query.category && record.category !== query.category) {
        return false;
      }

      if (query.taskId && record.scope?.taskId !== query.taskId) {
        return false;
      }

      if (query.stageId && record.scope?.stageId !== query.stageId) {
        return false;
      }

      return true;
    });
  }

  private requireTaskId(taskId?: TaskId): TaskId {
    if (taskId?.trim()) {
      return taskId;
    }

    throw new Error('History record requires a non-empty "taskId".');
  }

  private buildScope(taskId: TaskId, runId: string, stageId?: StageId): {
    taskId: TaskId;
    runId: string;
    stageId: StageId | null;
  } {
    return {
      taskId,
      runId,
      stageId: stageId ?? null,
    };
  }

  private requireRunId(runId?: string): string {
    if (runId?.trim()) {
      return runId;
    }

    throw new Error('History record requires a non-empty "runId".');
  }

  private normalizeOptionalIdentifier<T extends string | null>(value?: T): Exclude<T, null> | undefined {
    return typeof value === "string" && value.trim() ? value as Exclude<T, null> : undefined;
  }

  private resolveTaskBucketName(taskId?: TaskId, runId?: string): string {
    return runId ? `${taskId ?? "_global"}_${runId}` : (taskId ?? "_global");
  }

  private resolveTaskContext(taskId: TaskId): HistoryTaskContext {
    const resolved = this.workspaceRootResolver?.(taskId);
    if (!resolved) {
      return {};
    }

    if (typeof resolved === "string") {
      return {
        workspaceRoot: resolved,
      };
    }

    return resolved;
  }

  private resolveStorageRoot(workspaceRoot?: string): string {
    if (this.storageRoot) {
      return this.storageRoot;
    }

    if (workspaceRoot) {
      return path.resolve(workspaceRoot, "dist", "sdlc", "history_store");
    }

    return path.resolve(process.cwd(), "dist", "sdlc", "history_store");
  }


  private async readBucket(targetPath: string): Promise<HistoryRecord[]> {
    try {
      const raw = await readFile(targetPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed as HistoryRecord[] : [];
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  private async writeBucket(targetPath: string, records: HistoryRecord[]): Promise<void> {
    await this.writeFileAt(targetPath, JSON.stringify(records, null, 2));
  }

  private async writeFileAt(targetPath: string, content: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }

  private async listRecordFiles(recordsDirectory: string): Promise<string[]> {
    let entries: Array<{ name: string; isFile: boolean }>;

    try {
      entries = await readdir(recordsDirectory, { withFileTypes: true }).then((items) =>
        items.map((item) => ({
          name: item.name,
          isFile: item.isFile(),
        })),
      );
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    return entries
      .filter((entry) => entry.isFile && entry.name.endsWith(".json"))
      .map((entry) => path.join(recordsDirectory, entry.name as FilePath));
  }
}
