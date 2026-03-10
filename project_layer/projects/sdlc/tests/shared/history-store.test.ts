import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { HistoryStoreService } from "../../src/data/history-store/history-store.js";

export async function runHistoryStoreTests(): Promise<void> {
  await testHistoryStoreWriteReadAndList();
  await testHistoryStoreMirrorsAllCategoriesIntoWorkspaceTraceDirectory();
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
        stageId: "implementation",
      },
      summary: "Implementation started.",
      payload: {
        eventType: "stage_started",
      },
    });

    const record = await store.getRecord(recordId);
    assert.equal(record.recordId, recordId);
    assert.equal(record.category, "trace");
    assert.deepEqual(record.scope, {
      taskId: "task-1",
      runId: "run-a",
      stageId: "implementation",
    });

    await store.writeRecord({
      category: "trace",
      scope: {
        taskId: "task-2",
        runId: "run-b",
        stageId: "task_finished",
      },
      summary: "Task finished.",
      payload: {
        eventType: "task_finished",
      },
    });

    const taskScopedRecords = await store.listRecords({
      category: "trace",
      taskId: "task-1",
    });
    assert.equal(taskScopedRecords.length, 1);
    assert.equal(taskScopedRecords[0]?.recordId, recordId);
    const taskBucket = JSON.parse(
      await readFile(path.join(storageRoot, "records", "task-1_run-a.json"), "utf8"),
    ) as Array<{
      recordId: string;
      scope: { taskId: string; runId: string; stageId: string };
    }>;
    assert.equal(taskBucket.length, 1);
    assert.equal(taskBucket[0]?.recordId, recordId);
    assert.deepEqual(taskBucket[0]?.scope, {
      taskId: "task-1",
      runId: "run-a",
      stageId: "implementation",
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

async function testHistoryStoreMirrorsAllCategoriesIntoWorkspaceTraceDirectory(): Promise<void> {
  const storageRoot = await createTempDir("history-store-");
  const workspaceRoot = await createTempDir("history-workspace-");

  try {
    const store = new HistoryStoreService(
      storageRoot,
      (taskId) => (taskId === "task-history"
        ? { workspaceRoot, runId: "run-history" }
        : undefined),
    );
    const recordId = await store.writeRecord({
      category: "review",
      scope: {
        taskId: "task-history",
        runId: "run-history",
        stageId: "architecture_design",
      },
      summary: "Review comment captured.",
      payload: {
        comment: "Need one more refinement pass.",
      },
    });

    const mirroredRecord = JSON.parse(
      await readFile(
        path.join(workspaceRoot, "sdlc", "trace", "task-history_run-history.json"),
        "utf8",
      ),
    ) as Array<{
      recordId: string;
      category: string;
      scope: { taskId: string; runId: string; stageId: string };
      summary: string;
      payload: Record<string, unknown>;
    }>;

    assert.equal(mirroredRecord.length, 1);
    assert.equal(mirroredRecord[0]?.recordId, recordId);
    assert.equal(mirroredRecord[0]?.category, "review");
    assert.deepEqual(mirroredRecord[0]?.scope, {
      taskId: "task-history",
      runId: "run-history",
      stageId: "architecture_design",
    });
    assert.equal(mirroredRecord[0]?.summary, "Review comment captured.");
    assert.deepEqual(mirroredRecord[0]?.payload, {
      comment: "Need one more refinement pass.",
    });
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
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
          stageId: "architecture_design",
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
          stageId: null,
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
        stageId: null,
      },
      summary: "Missing stage id is allowed.",
      payload: {},
    });
    const record = await store.getRecord(recordId);
    assert.deepEqual(record.scope, {
      taskId: "task-1",
      runId: "run-1",
      stageId: null,
    });
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}
