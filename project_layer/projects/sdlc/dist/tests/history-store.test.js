import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { HistoryStoreService } from "../src/data/history-store/history-store.js";
export async function runHistoryStoreTests() {
    await testHistoryStoreWriteReadAndList();
}
async function testHistoryStoreWriteReadAndList() {
    const storageRoot = await createTempDir("history-store-");
    try {
        const store = new HistoryStoreService(storageRoot);
        const recordId = await store.writeRecord({
            category: "trace",
            taskId: "task-1",
            stageId: "implementation",
            summary: "Implementation started.",
            payload: {
                eventType: "stage_started",
            },
        });
        const record = await store.getRecord(recordId);
        assert.equal(record.recordId, recordId);
        assert.equal(record.category, "trace");
        assert.equal(record.taskId, "task-1");
        assert.equal(record.stageId, "implementation");
        await store.writeRecord({
            category: "trace",
            taskId: "task-2",
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
    }
    finally {
        await rm(storageRoot, { recursive: true, force: true });
    }
}
async function createTempDir(prefix) {
    const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
    await mkdir(tempRoot, { recursive: true });
    return mkdtemp(path.join(tempRoot, prefix));
}
