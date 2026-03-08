import assert from "node:assert/strict";

import { InMemoryTraceRecorder } from "../src/quality-gate/trace/trace-recorder.js";

export async function runTraceTests(): Promise<void> {
  await testTraceRecorderAssignsStableRefs();
}

async function testTraceRecorderAssignsStableRefs(): Promise<void> {
  const recorder = new InMemoryTraceRecorder();

  const ref1 = await recorder.recordTrace({
    taskId: "task-1",
    stageId: "implementation",
    eventType: "stage_started",
    summary: "Implementation started.",
  });
  const ref2 = await recorder.recordTrace({
    taskId: "task-1",
    eventType: "task_finished",
    summary: "Task finished.",
  });

  assert.equal(ref1, "trace-1");
  assert.equal(ref2, "trace-2");
  assert.deepEqual(recorder.getEvents(), [
    {
      ref: "trace-1",
      event: {
        taskId: "task-1",
        stageId: "implementation",
        eventType: "stage_started",
        summary: "Implementation started.",
      },
    },
    {
      ref: "trace-2",
      event: {
        taskId: "task-1",
        eventType: "task_finished",
        summary: "Task finished.",
      },
    },
  ]);
}
