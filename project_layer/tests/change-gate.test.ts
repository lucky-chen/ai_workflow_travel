import assert from "node:assert/strict";

import { InMemoryChangeGate } from "../src/quality-gate/change-gate/change-gate.js";

export async function runChangeGateTests(): Promise<void> {
  await testDefaultGateDecision();
  await testRejectingGateDecision();
}

async function testDefaultGateDecision(): Promise<void> {
  const gate = new InMemoryChangeGate();
  const request = createReviewRequest();

  const decision = await gate.review(request);
  assert.deepEqual(decision, {
    action: "apply",
    summary: "Change approved by default gate policy.",
  });
  assert.deepEqual(gate.getLastRequest(), request);
}

async function testRejectingGateDecision(): Promise<void> {
  const rejectingGate = new InMemoryChangeGate({
    decision: {
      action: "reject",
      summary: "Manual review rejected the change set.",
      comment: "Need additional validation.",
    },
  });
  const request = createReviewRequest();
  const rejectingDecision = await rejectingGate.review(request);
  assert.deepEqual(rejectingDecision, {
    action: "reject",
    summary: "Manual review rejected the change set.",
    comment: "Need additional validation.",
  });
}

function createReviewRequest() {
  return {
    taskId: "task-1",
    stageId: "implementation",
    summary: "Generated three file changes.",
    changedPaths: ["src/a.ts", "src/b.ts"],
    changedFiles: [
      { path: "src/a.ts", operation: "update" as const, content: "export const a = 1;\n" },
      { path: "src/b.ts", operation: "create" as const, content: "export const b = 2;\n" },
    ],
  };
}
