import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CLIService,
  ConsoleReviewInteraction,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
  ResourceWorkspaceInitializer,
} from "../src/interface/cli/cli.js";
import type { IPipeline, LaunchTaskRequest } from "../src/shared/contracts/pipeline.js";

export async function runCliTests(): Promise<void> {
  const workspaceRoot = await createTempDir("cli-workspace-");

  try {
    await seedWorkspace(workspaceRoot);
    await testCommandParser(workspaceRoot);
    await testRequestMapper(workspaceRoot);
    await testCliRunSuccess(workspaceRoot);
    await testCliRunMissingWorkspace();
    await testCliInitCopiesResources(workspaceRoot);
    await testRequestMapperRequiresStage();
    await testModuleDesignRequiresTargetModule(workspaceRoot);
    await testImplementationExecutionRequiresWorkplan(workspaceRoot);
    await testReviewInteractionApply();
    await testReviewInteractionReject();
    await testReviewInteractionComment();
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testCommandParser(workspaceRoot: string): Promise<void> {
  const parser = new DefaultCLICommandParser();
  assert.deepEqual(
    parser.parse(["generate", "--stage", "architecture_design", "--workspace", workspaceRoot]),
    {
      command: "generate",
      options: {
        stage: "architecture_design",
        workspace: workspaceRoot,
      },
    },
  );
}

async function testRequestMapper(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  assert.deepEqual(
    await mapper.map({
      command: "generate",
      options: {
        stage: "implementation_plan",
        workspace: workspaceRoot,
      },
    }),
    {
      startStageId: "implementation_plan",
      workspaceRoot,
      inputArtifacts: {
        requirement_document: "# Requirement\n",
        architecture_document: "# Architecture\n",
        module_design_documents: JSON.stringify([
          "# Module Alpha\n",
          "# Module Beta\n",
        ]),
      },
    },
  );
}

async function testCliRunSuccess(workspaceRoot: string): Promise<void> {
  const parser = new DefaultCLICommandParser();
  const mapper = new DefaultCLIRequestMapper();
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
    "--stage",
    "architecture_design",
    "--workspace",
    workspaceRoot,
  ]);

  assert.equal(exitCode, 0);
  assert.deepEqual(capturedRequest, {
    startStageId: "architecture_design",
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "# Requirement\n",
    },
  });
  assert.deepEqual(rendered, [
    'trace:task_launch_requested:Launching command "generate" for stage "architecture_design".',
    "status:Task launched: task-cli-1",
    "result:Completed command: generate",
  ]);
}

async function testCliRunMissingWorkspace(): Promise<void> {
  const parser = new DefaultCLICommandParser();
  const mapper = new DefaultCLIRequestMapper();
  const traceViewer: ConsoleTraceViewer = {
    renderStatus(): void {},
    renderTrace(): void {},
    renderResult(): void {},
  };
  const pipeline: IPipeline = {
    async launchTask(): Promise<string> {
      return "task-cli-1";
    },
  };
  const cli = new CLIService(parser, mapper, pipeline, traceViewer);
  await assert.rejects(
    async () => cli.run(["generate", "--stage", "architecture_design"]),
    /Missing required option: --workspace/,
  );
}

async function testCliInitCopiesResources(workspaceRoot: string): Promise<void> {
  const parser = new DefaultCLICommandParser();
  const mapper = new DefaultCLIRequestMapper();
  const initializer = new ResourceWorkspaceInitializer();
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
  const pipeline: IPipeline = {
    async launchTask(): Promise<string> {
      throw new Error("launchTask should not be called for init.");
    },
  };

  const cli = new CLIService(parser, mapper, pipeline, traceViewer, initializer);
  const exitCode = await cli.run(["init", "--workspace", workspaceRoot]);

  assert.equal(exitCode, 0);
  assert.deepEqual(rendered, [
    `status:Workspace initialized: ${workspaceRoot}`,
    `result:Copied SDLC resources to ${path.join(workspaceRoot, "sdlc", "resources")}`,
  ]);

  const copiedStandard = await readFile(
    path.join(workspaceRoot, "sdlc", "resources", "COLLABORATION_STANDARD.md"),
    "utf8",
  );
  assert.equal(copiedStandard.includes("# Collaboration Standard"), true);

  const localEnv = await readFile(path.join(workspaceRoot, "sdlc", "local_env.json"), "utf8");
  assert.equal(localEnv.includes('"provider": "openai"'), true);
  assert.equal(localEnv.includes('"api_key": "your-api-key"'), true);
}

async function testRequestMapperRequiresStage(): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  await assert.rejects(
    async () =>
      mapper.map({
        command: "generate",
        options: {
          workspace: "/tmp/project",
        },
      }),
    /Missing required option: --stage/,
  );
}

async function testModuleDesignRequiresTargetModule(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  await assert.rejects(
    async () =>
      mapper.map({
        command: "generate",
        options: {
          stage: "module_design",
          workspace: workspaceRoot,
        },
      }),
    /Missing required option: --target-module for stage "module_design"./,
  );
}

async function testImplementationExecutionRequiresWorkplan(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  await assert.rejects(
    async () =>
      mapper.map({
        command: "generate",
        options: {
          stage: "implementation_execution",
          workspace: workspaceRoot,
        },
      }),
    /Missing required workspace file: sdlc\/docs\/CodeGenerationExecutionPlan\.md/,
  );
}

async function testReviewInteractionApply(): Promise<void> {
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
    changedPaths: ["src/a.ts"],
    changedFiles: [
      { path: "src/a.ts", operation: "update", content: "export const a = 1;\n" },
    ],
  });
  assert.deepEqual(decision, {
    action: "apply",
    summary: "User approved the change set.",
  });
  assert.equal(reviewOutput.some((line) => line.includes("Review review-1: Review generated changes.")), true);
  assert.equal(reviewOutput.some((line) => line.includes("Changed paths: src/a.ts")), true);
}

async function testReviewInteractionReject(): Promise<void> {
  const rejectInteraction = new ConsoleReviewInteraction({
    async ask(): Promise<string> {
      return "reject";
    },
    write(): void {},
  });
  const rejectDecision = await rejectInteraction.waitForReview({
    reviewId: "review-2",
    summary: "Reject generated changes.",
    changedPaths: [],
    changedFiles: [],
  });
  assert.deepEqual(rejectDecision, {
    action: "reject",
    summary: "User rejected the change set.",
  });
}

async function testReviewInteractionComment(): Promise<void> {
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
    changedPaths: [],
    changedFiles: [],
  });
  assert.deepEqual(commentDecision, {
    action: "wait",
    summary: "User requested changes before apply.",
    comment: "Please regenerate the service layer.",
  });
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

async function seedWorkspace(workspaceRoot: string): Promise<void> {
  await writeWorkspaceFile(workspaceRoot, "sdlc/docs/Requirement.md", "# Requirement\n");
  await writeWorkspaceFile(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md", "# Architecture\n");
  await writeWorkspaceFile(workspaceRoot, "sdlc/docs/module_design/alpha.md", "# Module Alpha\n");
  await writeWorkspaceFile(workspaceRoot, "sdlc/docs/module_design/beta.md", "# Module Beta\n");
}

async function writeWorkspaceFile(workspaceRoot: string, relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}
