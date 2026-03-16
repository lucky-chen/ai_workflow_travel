import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CLIService,
  ConsoleReviewInteraction,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
  ResourceWorkspaceInitializer,
} from "../src/Interface/CliEntry/cli.js";
import type { Application } from "../src/Runtime/application.js";
import type { RuntimeInput } from "../src/Runtime/Schema/runtime.js";

export async function runCliTests(): Promise<void> {
  const workspaceRoot = await createTempDir("cli-workspace-");

  try {
    await testCommandParser(workspaceRoot);
    await testRequestMapperSupportsComposeStandard(workspaceRoot);
    await testRequestMapperSupportsComposeFrom(workspaceRoot);
    await testRequestMapperRejectsRunUnit(workspaceRoot);
    await testRequestMapperRejectsGenerate(workspaceRoot);
    await testCliRunComposeSuccess(workspaceRoot);
    await testCliInitCopiesResources(workspaceRoot);
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
    parser.parse(["run", "compose", "standard", "--workdir", workspaceRoot]),
    {
      command: "run",
      args: ["compose", "standard"],
      options: {
        workdir: workspaceRoot,
      },
    },
  );
}

async function testRequestMapperSupportsComposeStandard(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  assert.deepEqual(
    await mapper.map({
      command: "run",
      args: ["compose", "standard"],
      options: {
        workdir: workspaceRoot,
      },
    }),
    {
      mode: "compose",
      composeMode: "standard",
    },
  );
}

async function testRequestMapperSupportsComposeFrom(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  assert.deepEqual(
    await mapper.map({
      command: "run",
      args: ["compose", "from", "work_plan_generate"],
      options: {
        workdir: workspaceRoot,
        "run-id": "run-1",
      },
    }),
    {
      mode: "compose",
      composeMode: "from",
      entryUnit: "work_plan_generate",
    },
  );
}

async function testRequestMapperRejectsRunUnit(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  await assert.rejects(
    async () => mapper.map({
      command: "run",
      args: ["unit", "requirement_design_generate"],
      options: {
        workdir: workspaceRoot,
      },
    }),
    /run unit/,
  );
}

async function testRequestMapperRejectsGenerate(workspaceRoot: string): Promise<void> {
  const mapper = new DefaultCLIRequestMapper();
  await assert.rejects(
    async () => mapper.map({
      command: "generate",
      args: [],
      options: {
        workdir: workspaceRoot,
      },
    }),
    /legacy "generate" command/,
  );
}

async function testCliRunComposeSuccess(workspaceRoot: string): Promise<void> {
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

  let capturedInput: RuntimeInput | undefined;
  const application: Application = {
    async run(input: RuntimeInput) {
      capturedInput = input;
      return {
        accepted: true,
        summary: "Compose-run request accepted.",
      };
    },
  };

  const cli = new CLIService(parser, mapper, application, traceViewer);
  const exitCode = await cli.run([
    "run",
    "compose",
    "from",
    "architecture_design_generate",
    "--workdir",
    workspaceRoot,
    "--run-id",
    "run-1",
  ]);

  assert.equal(exitCode, 0);
  assert.deepEqual(capturedInput, {
    request: {
      mode: "compose",
      composeMode: "from",
      entryUnit: "architecture_design_generate",
    },
    context: {
      workspaceRoot,
      runId: "run-1",
      workspaceLocalEnv: {},
    },
  });
  assert.deepEqual(rendered, [
    'trace:task_launch_requested:Launching command "run" for compose mode "from".',
    "status:Compose-run request accepted.",
    "result:Completed command: run",
  ]);
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
    renderTrace(): void {},
    renderResult(summary: string): void {
      rendered.push(`result:${summary}`);
    },
  };
  const application: Application = {
    async run(): Promise<{ accepted: boolean; summary: string }> {
      throw new Error("run should not be called for init");
    },
  };

  const cli = new CLIService(parser, mapper, application, traceViewer, initializer);
  const exitCode = await cli.run(["init", "--workdir", workspaceRoot]);

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
}

async function testReviewInteractionApply(): Promise<void> {
  const prompts = createPromptAdapter(["apply"]);
  const interaction = new ConsoleReviewInteraction(prompts.adapter);
  const decision = await interaction.waitForReview({
    reviewId: "review-1",
    summary: "Review changes",
    changedPaths: ["src/index.ts"],
    changedFiles: [{ path: "src/index.ts", operation: "create", content: "export {};\n" }],
  });
  assert.deepEqual(decision, {
    action: "apply",
    summary: "User approved the change set.",
  });
}

async function testReviewInteractionReject(): Promise<void> {
  const prompts = createPromptAdapter(["reject"]);
  const interaction = new ConsoleReviewInteraction(prompts.adapter);
  const decision = await interaction.waitForReview({
    reviewId: "review-2",
    summary: "Review changes",
    changedPaths: [],
    changedFiles: [],
  });
  assert.deepEqual(decision, {
    action: "reject",
    summary: "User rejected the change set.",
  });
}

async function testReviewInteractionComment(): Promise<void> {
  const prompts = createPromptAdapter(["comment", "please fix"]);
  const interaction = new ConsoleReviewInteraction(prompts.adapter);
  const decision = await interaction.waitForReview({
    reviewId: "review-3",
    summary: "Review changes",
    changedPaths: [],
    changedFiles: [],
  });
  assert.deepEqual(decision, {
    action: "wait",
    summary: "User requested changes before apply.",
    comment: "please fix",
  });
}

function createPromptAdapter(answers: string[]): {
  adapter: { ask(prompt: string): Promise<string>; write(message: string): void };
} {
  const queue = [...answers];
  return {
    adapter: {
      async ask(): Promise<string> {
        return queue.shift() ?? "apply";
      },
      write(): void {},
    },
  };
}

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
