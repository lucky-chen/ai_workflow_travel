import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { HistoryStoreService } from "../../src/data/history-store/history-store.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import { TraceService } from "../../src/quality-gate/trace/trace-recorder.js";

export async function runTraceTests(): Promise<void> {
  await testTraceRecorderAssignsStableRefs();
  await testTraceServicePersistsHistory();
}

async function testTraceRecorderAssignsStableRefs(): Promise<void> {
  const recorder = new InMemoryTraceRecorder();

  const ref1 = await recorder.recordTrace({
    stageId: "implementation",
    caller: "trace.test",
    eventType: "stage_started",
    summary: "Implementation started.",
  });
  const ref2 = await recorder.recordTrace({
    caller: "trace.test",
    eventType: "task_finished",
    summary: "Task finished.",
  });

  assert.equal(ref1, "trace-1");
  assert.equal(ref2, "trace-2");
  assert.deepEqual(recorder.getEvents(), [
    {
      ref: "trace-1",
      event: {
        stageId: "implementation",
        caller: "trace.test",
        eventType: "stage_started",
        summary: "Implementation started.",
      },
    },
    {
      ref: "trace-2",
      event: {
        caller: "trace.test",
        eventType: "task_finished",
        summary: "Task finished.",
      },
    },
  ]);
}

async function testTraceServicePersistsHistory(): Promise<void> {
  const storageRoot = await createTempDir("trace-history-");

  try {
    const historyStore = new HistoryStoreService(storageRoot);
    const recorder = new TraceService(historyStore, {
      taskId: "task-1",
      runId: "run-1",
    });

    const ref = await recorder.recordTrace({
      stageId: "implementation",
      caller: "trace.test",
      eventType: "stage_started",
      summary: "Implementation started.",
      metadata: {
        source: "pipeline",
      },
    });

    const record = await historyStore.getRecord(ref);
    assert.equal(record.category, "trace");
    assert.deepEqual(record.scope, {
      taskId: "task-1",
      runId: "run-1",
      stageId: "implementation",
    });
    assert.equal(record.summary, "Implementation started.");
    assert.deepEqual(record.payload, {
      eventType: "stage_started",
      metadata: {
        source: "pipeline",
      },
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
