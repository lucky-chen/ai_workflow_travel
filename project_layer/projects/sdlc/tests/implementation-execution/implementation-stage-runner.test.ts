import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { ImplementationGenerator } from "../../src/execution/implementation-generator/implementation-generator.js";
import { ImplementationContract } from "../../src/contract/implementation-contract/implementation-contract.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import { ImplementationStageRunner } from "../../src/workflow/stage-runners/implementation-stage-runner.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import type { IContractChecker, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";

export async function runImplementationStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("implementation-stage-runner-");
  const workspaceRoot = await createTempDir("workspace-runner-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  await artifactStore.writeArtifact({
    taskId: "task-1",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });
  await artifactStore.writeArtifact({
    taskId: "task-2",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });
  await artifactStore.writeArtifact({
    taskId: "task-3",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });

  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");

  try {
    const generator = createGenerator(artifactStore);
    const contractChecker = ImplementationContract.create();

    await testImplementationStageRunnerApply(generator, contractChecker, workspaceRoot);
    await testImplementationStageRunnerReject(generator, contractChecker, workspaceRoot);
    await testImplementationStageRunnerContractFailure(generator, workspaceRoot);
    await testImplementationStageRunnerRequiresWorkplanAndCurrentStep(generator, contractChecker, workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testImplementationStageRunnerApply(
  generator: ImplementationGenerator,
  contractChecker: IContractChecker,
  workspaceRoot: string,
): Promise<void> {
  const applyGate = new InMemoryChangeGate();
  const traceRecorder = new InMemoryTraceRecorder();
  const runner = new ImplementationStageRunner({
    generator,
    contractChecker,
    changeGate: applyGate,
    traceRecorder,
  });

  const output = await runner.run(createRunContext("task-1", workspaceRoot));

  assert.equal(output.summary, "Planned implementation updates.");
  assert.equal(await readFile(path.join(workspaceRoot, "src", "generated.ts"), "utf8"), "export const generated = true;\n");
  assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 2;\n");
  await assert.rejects(access(path.join(workspaceRoot, "obsolete.txt")));
  assert.deepEqual(applyGate.getLastRequest()?.changedPaths, ["src/generated.ts", "src/existing.ts", "obsolete.txt"]);
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "gate_reviewed",
  ]);
  assert.deepEqual(traceRecorder.getEvents()[1]?.event.metadata, {
    action: "apply",
  });
}

async function testImplementationStageRunnerReject(
  generator: ImplementationGenerator,
  contractChecker: IContractChecker,
  workspaceRoot: string,
): Promise<void> {
  const rejectGate = new InMemoryChangeGate({
    decision: {
      action: "reject",
      summary: "Rejected in review.",
    },
  });
  const rejectRunner = new ImplementationStageRunner({
    generator,
    contractChecker,
    changeGate: rejectGate,
  });

  await resetWorkspace(workspaceRoot);

  await assert.rejects(
    rejectRunner.run(createRunContext("task-2", workspaceRoot)),
    /Change review ended with action "reject"/,
  );

  await assert.rejects(access(path.join(workspaceRoot, "src", "generated.ts")));
  assert.equal(await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"), "export const value = 1;\n");
  assert.equal(await readFile(path.join(workspaceRoot, "obsolete.txt"), "utf8"), "to be deleted\n");
}

async function testImplementationStageRunnerContractFailure(
  generator: ImplementationGenerator,
  workspaceRoot: string,
): Promise<void> {
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
    changeGate: failingGate,
  });

  await resetWorkspace(workspaceRoot);

  await assert.rejects(
    failingRunner.run(createRunContext("task-3", workspaceRoot)),
    /Implementation contract failed: Contract failed before apply\./,
  );

  assert.equal(failingGate.getLastRequest(), undefined);
  await assert.rejects(access(path.join(workspaceRoot, "src", "generated.ts")));
}

async function testImplementationStageRunnerRequiresWorkplanAndCurrentStep(
  generator: ImplementationGenerator,
  contractChecker: IContractChecker,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ImplementationStageRunner({
    generator,
    contractChecker,
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
}

function createGenerator(artifactStore: ArtifactStoreService): ImplementationGenerator {
  return new ImplementationGenerator({
    artifactStore,
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
  overrides?: Partial<Record<"implementation_workplan" | "current_step", string | undefined>>,
): StageRunContext {
  const inputArtifacts: Record<string, string> = {
    moduleDesign: "module-design.md",
    implementation_workplan: "plans/implementation/ImplementationWorkPlan.md",
    current_step: "step-1",
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

  return {
    taskId,
    stageId: "implementation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts,
    params: {
      moduleDesignStageId: "module-design",
      testCommand: 'node -e "process.exit(0)"',
    },
  };
}

async function resetWorkspace(workspaceRoot: string): Promise<void> {
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");
  await rm(path.join(workspaceRoot, "src", "generated.ts"), { force: true });
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
