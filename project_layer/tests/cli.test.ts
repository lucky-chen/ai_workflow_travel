import assert from "node:assert/strict";

import {
  CLIService,
  ConsoleReviewInteraction,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
} from "../src/interface/cli/cli.js";
import type { IPipeline, LaunchTaskRequest } from "../src/shared/contracts/pipeline.js";

export async function runCliTests(): Promise<void> {
  const parser = new DefaultCLICommandParser();
  assert.deepEqual(parser.parse(["generate", "--module", "implementation", "--input", "module.md", "--workspace", "./demo"]), {
    command: "generate",
    options: {
      module: "implementation",
      input: "module.md",
      workspace: "./demo",
    },
  });

  const mapper = new DefaultCLIRequestMapper();
  assert.deepEqual(
    mapper.map({
      command: "generate",
      options: {
        module: "implementation",
        input: "module.md",
        workspace: "./demo",
      },
    }),
    {
      startStageId: "implementation",
      workspaceRoot: "./demo",
      inputArtifacts: {
        moduleDesign: "module.md",
      },
    },
  );

  const rendered: string[] = [];
  const traceViewer: ConsoleTraceViewer = {
    renderStatus(message: string): void {
      rendered.push(`status:${message}`);
    },
    renderTrace(event): void {
      rendered.push(`trace:${event.eventType}:${event.summary}`);
    },
    renderResult(summary: string): void {
      rendered.push(`result:${summary}`);
    },
  };

  let capturedRequest: LaunchTaskRequest | undefined;
  const pipeline: IPipeline = {
    async launchTask(request: LaunchTaskRequest): Promise<string> {
      capturedRequest = request;
      return "task-cli-1";
    },
  };

  const cli = new CLIService(parser, mapper, pipeline, traceViewer);
  const exitCode = await cli.run([
    "generate",
    "--module",
    "implementation",
    "--input",
    "module.md",
    "--workspace",
    "./demo",
  ]);

  assert.equal(exitCode, 0);
  assert.deepEqual(capturedRequest, {
    startStageId: "implementation",
    workspaceRoot: "./demo",
    inputArtifacts: {
      moduleDesign: "module.md",
    },
  });
  assert.deepEqual(rendered, [
    'trace:task_launch_requested:Launching command "generate" for stage "implementation".',
    "status:Task launched: task-cli-1",
    "result:Completed command: generate",
  ]);

  await assert.rejects(
    async () => cli.run(["generate", "--module", "implementation", "--input", "module.md"]),
    /Missing required option: --workspace/,
  );

  const reviewOutput: string[] = [];
  const reviewInteraction = new ConsoleReviewInteraction({
    async ask(): Promise<string> {
      return "apply";
    },
    write(message: string): void {
      reviewOutput.push(message);
    },
  });
  const decision = await reviewInteraction.waitForReview({
    reviewId: "review-1",
    summary: "Review generated changes.",
    changedFiles: [
      { path: "src/a.ts", operation: "update", content: "export const a = 1;\n" },
    ],
  });
  assert.deepEqual(decision, {
    action: "apply",
    summary: "User approved the change set.",
  });
  assert.equal(reviewOutput.some((line) => line.includes("Review generated changes.")), true);

  const rejectInteraction = new ConsoleReviewInteraction({
    async ask(): Promise<string> {
      return "reject";
    },
    write(): void {},
  });
  const rejectDecision = await rejectInteraction.waitForReview({
    reviewId: "review-2",
    summary: "Reject generated changes.",
    changedFiles: [],
  });
  assert.deepEqual(rejectDecision, {
    action: "reject",
    summary: "User rejected the change set.",
  });

  const commentInteraction = new ConsoleReviewInteraction({
    async ask(prompt: string): Promise<string> {
      if (prompt.includes("Apply changes?")) {
        return "comment";
      }

      return "Please regenerate the service layer.";
    },
    write(): void {},
  });
  const commentDecision = await commentInteraction.waitForReview({
    reviewId: "review-3",
    summary: "Comment on generated changes.",
    changedFiles: [],
  });
  assert.deepEqual(commentDecision, {
    action: "wait",
    summary: "User requested changes before apply.",
    comment: "Please regenerate the service layer.",
  });
}
