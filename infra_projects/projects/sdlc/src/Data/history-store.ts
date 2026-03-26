import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExecutionUnitId, TaskId, TraceRef } from "../Runtime/Schema/runtime.js";

export interface HistoryRecord {
  recordId?: TraceRef;
  category: string;
  caller?: string;
  scope?: {
    taskId: TaskId;
    runId: string;
    executionUnitId: ExecutionUnitId | null;
  };
  summary?: string;
  payload: Record<string, unknown>;
}

export interface HistoryQuery {
  category?: string;
  taskId?: TaskId;
  executionUnitId?: ExecutionUnitId;
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
    const executionUnitId = this.normalizeOptionalIdentifier(record.scope?.executionUnitId);
    const storageRoot = this.resolveStorageRoot(resolvedTaskContext.workspaceRoot);
    const persistedRecord: HistoryRecord = {
      ...record,
      scope: this.buildScope(taskId, runId, executionUnitId),
      recordId,
    };
    const targetPath = path.join(storageRoot, runId, "trace.json");
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
    const recordFiles = await this.listRecordFiles(this.resolveStorageRoot());
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

      if (query.executionUnitId && record.scope?.executionUnitId !== query.executionUnitId) {
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

  private buildScope(taskId: TaskId, runId: string, executionUnitId?: ExecutionUnitId): {
    taskId: TaskId;
    runId: string;
    executionUnitId: ExecutionUnitId | null;
  } {
    return {
      taskId,
      runId,
      executionUnitId: executionUnitId ?? null,
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
      return path.resolve(workspaceRoot, "dist", "sdlc");
    }

    return path.resolve(process.cwd(), "dist", "sdlc");
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

  private async listRecordFiles(storageRoot: string): Promise<string[]> {
    let entries;

    try {
      entries = await readdir(storageRoot, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(storageRoot, entry.name, "trace.json"))
      .reduce<Promise<string[]>>(async (previousPromise, candidatePath) => {
        const collected = await previousPromise;
        try {
          await access(candidatePath);
          collected.push(candidatePath);
        } catch (error) {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code !== "ENOENT") {
            throw error;
          }
        }
        return collected;
      }, Promise.resolve([]));
  }
}
