import assert from "node:assert/strict";

import { ChangeReviewPresenter, InMemoryChangeGate, InteractiveChangeGate } from "../src/quality-gate/change-gate/change-gate.js";

export async function runChangeGateTests(): Promise<void> {
  await testDefaultGateDecision();
  await testRejectingGateDecision();
  await testChangeReviewPresenter();
  await testInteractiveGateUsesPresenter();
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

async function testChangeReviewPresenter(): Promise<void> {
  const presenter = new ChangeReviewPresenter();
  const reviewSession = presenter.present("review-1", createReviewRequest());

  assert.deepEqual(reviewSession, {
    reviewId: "review-1",
    summary: "Generated three file changes.",
    changedFiles: [
      { path: "src/a.ts", operation: "update", content: "export const a = 1;\n" },
      { path: "src/b.ts", operation: "create", content: "export const b = 2;\n" },
    ],
  });
}

async function testInteractiveGateUsesPresenter(): Promise<void> {
  const receivedSessions: Array<{ reviewId: string; summary: string; changedFiles: Array<{ path: string }> }> = [];
  const presenter = new ChangeReviewPresenter();
  const gate = new InteractiveChangeGate(
    {
      async waitForReview(reviewSession) {
        receivedSessions.push({
          reviewId: reviewSession.reviewId,
          summary: reviewSession.summary,
          changedFiles: reviewSession.changedFiles.map((file) => ({ path: file.path })),
        });
        return {
          action: "apply",
          summary: "Approved interactively.",
        };
      },
    },
    presenter,
  );

  const decision = await gate.review(createReviewRequest());

  assert.deepEqual(decision, {
    action: "apply",
    summary: "Approved interactively.",
  });
  assert.deepEqual(receivedSessions, [
    {
      reviewId: "review-1",
      summary: "Generated three file changes.",
      changedFiles: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
    },
  ]);
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
