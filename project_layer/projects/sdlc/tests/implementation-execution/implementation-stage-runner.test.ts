import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { ImplementationGenerator } from "../../src/execution/implementation-generator/implementation-generator.js";
import { ImplementationContract } from "../../src/contract/implementation-contract/implementation-contract.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import type { IImplementationGitCommitter } from "../../src/workflow/stage-runners/implementation-git-committer.js";
import { ImplementationStageRunner } from "../../src/workflow/stage-runners/implementation-stage-runner.js";
import {
  resolveImplementationPlanArtifactPath,
  resolveStageContractFailureArtifactPath,
} from "../../src/workflow/stage-runners/stage-artifact-paths.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import type { IContractChecker, IStageGenerator, ImplementationStageArtifacts, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";

export async function runImplementationStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("implementation-stage-runner-");
  const workspaceRoot = await createTempDir("workspace-runner-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  try {
    await seedWorkspace(workspaceRoot);
    const generator = createGenerator(artifactStore);
    const contractChecker = ImplementationContract.create();

    await testImplementationStageRunnerApply(generator, contractChecker, artifactStore, workspaceRoot);
    await testImplementationStageRunnerReject(generator, contractChecker, artifactStore, workspaceRoot);
    await testImplementationStageRunnerContractFailure(generator, artifactStore, workspaceRoot);
    await testImplementationStageRunnerRequiresWorkplanAndCurrentStep(
      generator,
      contractChecker,
      artifactStore,
      workspaceRoot,
    );
    await testImplementationStageRunnerReturnsNextCurrentStep(artifactStore, workspaceRoot);
    await testImplementationStageRunnerMarksExecutionCompletedAtLastBatch(artifactStore, workspaceRoot);
    await testImplementationStageRunnerWaitReviewCarriesComment(artifactStore, workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testImplementationStageRunnerApply(
  generator: ImplementationGenerator,
  contractChecker: IContractChecker,
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const applyGate = new InMemoryChangeGate();
  const traceRecorder = new InMemoryTraceRecorder();
  const gitCommitter = new MockImplementationGitCommitter();
  const runner = new ImplementationStageRunner({
    generator,
    contractChecker,
    artifactStore,
    changeGate: applyGate,
    traceRecorder,
    gitCommitter,
  });

  const output = await runner.run(createRunContext("task-1", workspaceRoot));

  assert.equal(output.summary, "Planned implementation updates.");
  assert.equal(await readFile(path.join(workspaceRoot, "src", "generated.ts"), "utf8"), "export const generated = true;\n");
  assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 2;\n");
  await assert.rejects(access(path.join(workspaceRoot, "obsolete.txt")));
  assert.deepEqual(applyGate.getLastRequest()?.changedPaths, ["src/generated.ts", "src/existing.ts", "obsolete.txt"]);
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "contract_checked",
    "gate_reviewed",
    "step_completed",
  ]);
  assert.deepEqual(traceRecorder.getEvents()[1]?.event.metadata, {
    passed: "true",
  });
  assert.deepEqual(traceRecorder.getEvents()[0]?.event.payload?.inputPaths, [
    "sdlc/docs/CodeGenerationExecutionPlan.md",
    "sdlc/docs/Requirement.md",
    "sdlc/docs/TechnicalArchitecture.md",
    "sdlc/docs/module_design/Workflow.md",
  ]);
  assert.deepEqual(traceRecorder.getEvents()[2]?.event.metadata, {
    action: "apply",
  });
  assert.deepEqual(traceRecorder.getEvents()[2]?.event.payload?.outputPaths, [
    "src/generated.ts",
    "src/existing.ts",
    "obsolete.txt",
  ]);
  assert.deepEqual(traceRecorder.getEvents()[3]?.event.metadata, {
    batchId: "batch-1",
    changedFileCount: "3",
  });
  assert.deepEqual(traceRecorder.getEvents()[3]?.event.payload?.outputPaths, [
    "src/generated.ts",
    "src/existing.ts",
    "obsolete.txt",
  ]);
  assert.deepEqual(gitCommitter.calls, [
    {
      workspaceRoot,
      stepId: "step-1",
      batchId: "batch-1",
    },
  ]);
  assert.equal(output.artifacts.current_step, undefined);
  assert.equal(output.artifacts.implementation_execution_completed, "true");
  const updatedWorkplan = await readFile(
    path.join(workspaceRoot, resolveImplementationPlanArtifactPath(workspaceRoot)),
    "utf8",
  );
  assert.equal(updatedWorkplan.includes("## 4. Implementation Execution State"), true);
  assert.equal(updatedWorkplan.includes("- [x] batch-1"), true);
}

async function testImplementationStageRunnerReject(
  generator: ImplementationGenerator,
  contractChecker: IContractChecker,
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const rejectGate = new InMemoryChangeGate({
    decision: {
      action: "reject",
      summary: "Rejected in review.",
    },
  });
  const rejectRunner = new ImplementationStageRunner({
    generator,
    contractChecker,
    artifactStore,
    changeGate: rejectGate,
    traceRecorder,
    gitCommitter: new MockImplementationGitCommitter(),
  });

  await resetWorkspace(workspaceRoot);

  await assert.rejects(
    rejectRunner.run(createRunContext("task-2", workspaceRoot)),
    /Change review ended with action "reject"/,
  );

  assert.equal(traceRecorder.getEvents().some((entry) => entry.event.eventType === "step_completed"), false);
  assert.equal(await readFile(path.join(workspaceRoot, "src", "generated.ts"), "utf8"), "export const generated = true;\n");
  assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 2;\n");
  await assert.rejects(access(path.join(workspaceRoot, "obsolete.txt")));
  const workplan = await readFile(
    path.join(workspaceRoot, resolveImplementationPlanArtifactPath(workspaceRoot)),
    "utf8",
  );
  assert.equal(workplan.includes("## 4. Implementation Execution State"), false);
}

async function testImplementationStageRunnerContractFailure(
  generator: ImplementationGenerator,
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const failingGate = new InMemoryChangeGate();
  const failingContractChecker: IContractChecker = {
    async check(_context: StageRunContext, _output: StageOutput): Promise<{
      passed: boolean;
      summary: string;
      issues: Array<{ checkItem: string; message: string; severity: "high" }>;
    }> {
      return {
        passed: false,
        summary: "Contract failed before apply.",
        issues: [{ checkItem: "implementation-contract", message: "failed", severity: "high" }],
      };
    },
  };
  const failingRunner = new ImplementationStageRunner({
    generator,
    contractChecker: failingContractChecker,
    artifactStore,
    changeGate: failingGate,
    traceRecorder,
    gitCommitter: new MockImplementationGitCommitter(),
  });

  await resetWorkspace(workspaceRoot);

  await assert.rejects(
    failingRunner.run(createRunContext("task-3", workspaceRoot)),
    /Implementation contract failed: Contract failed before apply\./,
  );
  const failureArtifact = JSON.parse(
    await readFile(
      path.join(workspaceRoot, resolveStageContractFailureArtifactPath(workspaceRoot, "implementation")),
      "utf8",
    ),
  ) as { failedAt: string; summary: string };
  assert.equal(failureArtifact.failedAt, "contract_check");
  assert.equal(failureArtifact.summary, "Contract failed before apply.");

  assert.equal(failingGate.getLastRequest(), undefined);
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "contract_checked",
  ]);
  assert.deepEqual(traceRecorder.getEvents()[1]?.event.metadata, {
    passed: "false",
  });
  assert.equal(await readFile(path.join(workspaceRoot, "src", "generated.ts"), "utf8"), "export const generated = true;\n");
  assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 2;\n");
  await assert.rejects(access(path.join(workspaceRoot, "obsolete.txt")));
  const workplan = await readFile(
    path.join(workspaceRoot, resolveImplementationPlanArtifactPath(workspaceRoot)),
    "utf8",
  );
  assert.equal(workplan.includes("## 4. Implementation Execution State"), false);
}

async function testImplementationStageRunnerRequiresWorkplanAndCurrentStep(
  generator: ImplementationGenerator,
  contractChecker: IContractChecker,
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ImplementationStageRunner({
    generator,
    contractChecker,
    artifactStore,
    gitCommitter: new MockImplementationGitCommitter(),
  });

  await assert.rejects(
    runner.run(
      createRunContext("task-4", workspaceRoot, {
        implementation_workplan: undefined,
      }),
    ),
    /Missing required input artifact "implementation_workplan"\./,
  );

  await assert.rejects(
    runner.run(
      createRunContext("task-5", workspaceRoot, {
        current_step: undefined,
      }),
    ),
    /Missing required input artifact "current_step"\./,
  );

  await assert.rejects(
    runner.run(
      createRunContext("task-5", workspaceRoot, {
        current_step: "step-1",
      }),
    ),
    /Input artifact "current_step" must be valid JSON with \{ stepId, batchId \}\./,
  );
}

async function testImplementationStageRunnerReturnsNextCurrentStep(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ImplementationStageRunner({
    generator: createStubGenerator(),
    contractChecker: createPassingContractChecker(),
    artifactStore,
    gitCommitter: new MockImplementationGitCommitter(),
  });

  await resetWorkspace(workspaceRoot);

  const output = await runner.run(
    createRunContext("task-1", workspaceRoot, {
      parsed_implementation_workplan: JSON.stringify(createMultiStepWorkplan()),
      current_step: JSON.stringify({ stepId: "step-1", batchId: "batch-1" }),
    }),
  );

  assert.equal(output.artifacts.current_step, JSON.stringify({ stepId: "step-1", batchId: "batch-2" }));
  assert.equal(output.artifacts.implementation_execution_completed, "false");
}

async function testImplementationStageRunnerMarksExecutionCompletedAtLastBatch(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ImplementationStageRunner({
    generator: createStubGenerator(),
    contractChecker: createPassingContractChecker(),
    artifactStore,
    gitCommitter: new MockImplementationGitCommitter(),
  });

  await resetWorkspace(workspaceRoot);

  const output = await runner.run(
    createRunContext("task-1", workspaceRoot, {
      parsed_implementation_workplan: JSON.stringify(createMultiStepWorkplan()),
      current_step: JSON.stringify({ stepId: "step-2", batchId: "batch-2" }),
    }),
  );

  assert.equal(output.artifacts.current_step, undefined);
  assert.equal(output.artifacts.implementation_execution_completed, "true");
}

async function testImplementationStageRunnerWaitReviewCarriesComment(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const runner = new ImplementationStageRunner({
    generator: createStubGenerator(),
    contractChecker: createPassingContractChecker(),
    artifactStore,
    traceRecorder,
    changeGate: new InMemoryChangeGate({
      decision: {
        action: "wait",
        summary: "User requested revisions.",
        comment: "Please split the adapter and parser.",
      },
    }),
    gitCommitter: new MockImplementationGitCommitter(),
  });

  await resetWorkspace(workspaceRoot);

  await assert.rejects(
    runner.run(
      createRunContext("task-2", workspaceRoot, {
        current_step: JSON.stringify({ stepId: "step-1", batchId: "batch-1" }),
      }),
    ),
    /Change review ended with action "wait"\./,
  );

  assert.deepEqual(traceRecorder.getEvents()[2]?.event.metadata, {
    action: "wait",
    comment: "Please split the adapter and parser.",
  });
  assert.equal(traceRecorder.getEvents().some((entry) => entry.event.eventType === "step_completed"), false);

  const workplan = await readFile(
    path.join(workspaceRoot, resolveImplementationPlanArtifactPath(workspaceRoot)),
    "utf8",
  );
  assert.equal(workplan.includes("## 4. Implementation Execution State"), false);
}

function createGenerator(artifactStore: ArtifactStoreService): ImplementationGenerator {
  void artifactStore;
  return new ImplementationGenerator({
    llmExecutor: new MockLlmExecutor({
      summary: "Planned implementation updates.",
      changed_files: [
        { path: "src/generated.ts", operation: "create", content: "export const generated = true;\n" },
        { path: "src/existing.ts", operation: "update", content: "export const value = 2;\n" },
        { path: "obsolete.txt", operation: "delete" },
      ],
    }),
  });
}

function createRunContext(
  taskId: string,
  workspaceRoot: string,
  overrides?: Partial<Record<"implementation_workplan" | "current_step" | "parsed_implementation_workplan", string | undefined>>,
): StageRunContext {
  const inputArtifacts: Record<string, string> = {
    module_design_documents: JSON.stringify(["sdlc/docs/module_design/Workflow.md"]),
    requirement_document: "# requirement",
    architecture_document: "# architecture",
    implementation_workplan: resolveImplementationPlanArtifactPath(workspaceRoot),
    parsed_implementation_workplan: JSON.stringify(createParsedWorkplan()),
    current_step: JSON.stringify({ stepId: "step-1", batchId: "batch-1" }),
  };

  if (overrides && "implementation_workplan" in overrides) {
    if (typeof overrides.implementation_workplan === "string") {
      inputArtifacts.implementation_workplan = overrides.implementation_workplan;
    } else {
      delete inputArtifacts.implementation_workplan;
    }
  }

  if (overrides && "current_step" in overrides) {
    if (typeof overrides.current_step === "string") {
      inputArtifacts.current_step = overrides.current_step;
    } else {
      delete inputArtifacts.current_step;
    }
  }

  if (overrides && "parsed_implementation_workplan" in overrides) {
    if (typeof overrides.parsed_implementation_workplan === "string") {
      inputArtifacts.parsed_implementation_workplan = overrides.parsed_implementation_workplan;
    } else {
      delete inputArtifacts.parsed_implementation_workplan;
    }
  }

  return {
    taskId,
    stageId: "implementation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts,
    params: {
      testCommand: 'node -e "process.exit(0)"',
    },
  };
}

async function resetWorkspace(workspaceRoot: string): Promise<void> {
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");
  await rm(path.join(workspaceRoot, "src", "generated.ts"), { force: true });
  await writeFile(path.join(workspaceRoot, "sdlc", "docs", "module_design", "Workflow.md"), "# module design", "utf8");
  await writeFile(
    path.join(workspaceRoot, resolveImplementationPlanArtifactPath(workspaceRoot)),
    createImplementationWorkplanDocument(),
    "utf8",
  );
}

async function seedWorkspace(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, "sdlc", "docs", "module_design"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "sdlc", "docs", "module_design", "Workflow.md"), "# module design", "utf8");
  await writeFile(
    path.join(workspaceRoot, resolveImplementationPlanArtifactPath(workspaceRoot)),
    createImplementationWorkplanDocument(),
    "utf8",
  );
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class MockLlmExecutor implements ILlmExecutor {
  constructor(private readonly result: Record<string, unknown>) {}

  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: JSON.stringify(this.result),
      responseFormat: "json",
    };
  }
}

class MockImplementationGitCommitter implements IImplementationGitCommitter {
  readonly calls: Array<{ workspaceRoot: string; stepId: string; batchId: string }> = [];

  async commit(context: { workspaceRoot: string; stepId: string; batchId: string }): Promise<void> {
    this.calls.push(context);
  }
}

function createPassingContractChecker(): IContractChecker {
  return {
    async check(): Promise<{ passed: true; summary: string; issues: [] }> {
      return {
        passed: true,
        summary: "Implementation contract passed.",
        issues: [],
      };
    },
  };
}

function createStubGenerator(): IStageGenerator<StageOutput<ImplementationStageArtifacts>> {
  return {
    async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
      const preparedStepContext = JSON.parse(context.inputArtifacts.prepared_step_context ?? "{}") as {
        currentBatch?: { batchId?: string };
      };
      const batchId = preparedStepContext.currentBatch?.batchId ?? "unknown-batch";

      return {
        stageId: context.stageId,
        success: true,
        summary: `Generated changes for ${batchId}.`,
        artifacts: {
          changedFiles: [
            {
              path: `src/${batchId}.ts`,
              operation: "create",
              content: `export const batch = "${batchId}";\n`,
            },
          ],
          summary: `Generated changes for ${batchId}.`,
        },
      };
    },
  };
}

function createParsedWorkplan() {
  return {
    steps: [
      {
        stepId: "step-1",
        title: "Shared Workflow Backbone",
        status: "in_progress",
        architectureModulesInScope: ["Workflow/Pipeline"],
        batches: [
          {
            batchId: "batch-1",
            title: "interfaces and skeleton",
            status: "completed",
            tasks: ["shared contracts"],
          },
        ],
      },
    ],
  };
}

function createMultiStepWorkplan() {
  return {
    steps: [
      {
        stepId: "step-1",
        title: "Shared Workflow Backbone",
        status: "in_progress",
        architectureModulesInScope: ["Workflow/Pipeline"],
        batches: [
          {
            batchId: "batch-1",
            title: "interfaces and skeleton",
            status: "completed",
            tasks: ["shared contracts"],
          },
          {
            batchId: "batch-2",
            title: "pipeline orchestration",
            status: "not_started",
            tasks: ["pipeline loop"],
          },
        ],
      },
      {
        stepId: "step-2",
        title: "Implementation Execution",
        status: "not_started",
        architectureModulesInScope: ["Execution/ImplementationGenerator"],
        batches: [
          {
            batchId: "batch-1",
            title: "runner continuation",
            status: "not_started",
            tasks: ["next current step"],
          },
          {
            batchId: "batch-2",
            title: "review comment",
            status: "not_started",
            tasks: ["comment trace"],
          },
        ],
      },
    ],
  };
}

function createImplementationWorkplanDocument(): string {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Purpose",
    "Build project_layer from zero to a complete workflow.",
    "",
    "## 1.1 Collaboration Rule",
    "All implementation work under this plan must follow the shared collaboration standard:",
    "",
    "- `meta_layer/resources/COLLABORATION_STANDARD.md`",
    "",
    "## 2. Workflow Delivery Order",
    "1. shared workflow backbone",
    "",
    "## 3. Execution Steps",
    "### Step 1. Deliver Shared Workflow Backbone",
    "- [x] Step 1 is partially completed",
    "- [x] Architecture modules in scope",
    "  - [x] `Workflow/Pipeline`",
    "- [x] Batch 1: interfaces and skeleton",
    "  - [x] shared contracts",
  ].join("\n");
}
