import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { HistoryStoreService } from "../../src/Data/history-store.js";

export async function runHistoryStoreTests(): Promise<void> {
  await testHistoryStoreWriteReadAndList();
  await testHistoryStoreRequiresTaskId();
}

async function testHistoryStoreWriteReadAndList(): Promise<void> {
  const storageRoot = await createTempDir("history-store-");

  try {
    const store = new HistoryStoreService(storageRoot);
    const recordId = await store.writeRecord({
      category: "trace",
      scope: {
        taskId: "task-1",
        runId: "run-a",
        executionUnitId: "implementation",
      },
      summary: "Implementation started.",
      payload: {
        eventType: "generation_started",
      },
    });

    const record = await store.getRecord(recordId);
    assert.equal(record.recordId, recordId);
    assert.equal(record.category, "trace");
    assert.deepEqual(record.scope, {
      taskId: "task-1",
      runId: "run-a",
      executionUnitId: "implementation",
    });

    await store.writeRecord({
      category: "trace",
      scope: {
        taskId: "task-2",
        runId: "run-b",
        executionUnitId: "validation_finished",
      },
      summary: "Task finished.",
      payload: {
        eventType: "validation_finished",
      },
    });

    const taskScopedRecords = await store.listRecords({
      category: "trace",
      taskId: "task-1",
    });
    assert.equal(taskScopedRecords.length, 1);
    assert.equal(taskScopedRecords[0]?.recordId, recordId);
    const taskBucket = JSON.parse(
      await readFile(path.join(storageRoot, "run-a", "trace.json"), "utf8"),
    ) as Array<{
      recordId: string;
      scope: { taskId: string; runId: string; executionUnitId: string };
    }>;
    assert.equal(taskBucket.length, 1);
    assert.equal(taskBucket[0]?.recordId, recordId);
    assert.deepEqual(taskBucket[0]?.scope, {
      taskId: "task-1",
      runId: "run-a",
      executionUnitId: "implementation",
    });
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

async function testHistoryStoreRequiresTaskId(): Promise<void> {
  const storageRoot = await createTempDir("history-store-");

  try {
    const store = new HistoryStoreService(storageRoot);

    await assert.rejects(
      store.writeRecord({
        category: "trace",
        scope: {
          taskId: "",
          runId: "run-invalid",
          executionUnitId: "architecture_design",
        },
        summary: "Missing task id.",
        payload: {},
      }),
      /taskId/,
    );

    await assert.rejects(
      store.writeRecord({
        category: "trace",
        scope: {
          taskId: "task-1",
          runId: "",
          executionUnitId: null,
        },
        summary: "Missing run id.",
        payload: {},
      }),
      /runId/,
    );

    const recordId = await store.writeRecord({
      category: "trace",
      scope: {
        taskId: "task-1",
        runId: "run-1",
        executionUnitId: null,
      },
      summary: "Missing execution unit id is allowed.",
      payload: {},
    });
    const record = await store.getRecord(recordId);
    assert.deepEqual(record.scope, {
      taskId: "task-1",
      runId: "run-1",
      executionUnitId: null,
    });
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}
