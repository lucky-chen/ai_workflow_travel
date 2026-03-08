import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import { ValidationStageRunner } from "../../src/workflow/stage-runners/validation-stage-runner.js";
import type { ShellResult } from "../../src/workflow/validation/shell-runner.js";
import { ShellRunner } from "../../src/workflow/validation/shell-runner.js";

export async function runValidationStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("validation-stage-runner-storage-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  try {
    await testValidationStageRunnerPassesWithoutOptionalCollaborators();
    await testValidationStageRunnerRejectsOnGateDecision();
    await testValidationStageRunnerRecordsTraceAndPersistsArtifact(artifactStore);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function testValidationStageRunnerPassesWithoutOptionalCollaborators(): Promise<void> {
  const runner = new ValidationStageRunner({
    shellRunner: new MockShellRunner({
      passed: true,
      summary: 'Shell command passed: cd "/tmp/project" && npm test',
      command: 'cd "/tmp/project" && npm test',
      exit_code: 0,
      logs: "ok",
    }),
  });

  const output = await runner.run(createContext({ project_path: "/tmp/project" }));

  assert.deepEqual(output, {
    stageId: "validation",
    success: true,
    summary: 'Shell command passed: cd "/tmp/project" && npm test',
    artifacts: {
      artifactKey: "validation_result",
      projectPath: "/tmp/project",
      command: 'cd "/tmp/project" && npm test',
      exitCode: 0,
      logs: "ok",
      passed: true,
    },
  });
}

async function testValidationStageRunnerRejectsOnGateDecision(): Promise<void> {
  const runner = new ValidationStageRunner({
    shellRunner: new MockShellRunner({
      passed: true,
      summary: "Shell command passed: custom validation",
      command: "custom validation",
      exit_code: 0,
    }),
    changeGate: new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Validation rejected by reviewer.",
      },
    }),
  });

  await assert.rejects(
    runner.run(
      createContext(
        { project_path: "/tmp/project" },
        { validationCommand: "custom validation" },
      ),
    ),
    /Validation review ended with action "reject"\./,
  );
}

async function testValidationStageRunnerRecordsTraceAndPersistsArtifact(
  artifactStore: ArtifactStoreService,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const runner = new ValidationStageRunner({
    shellRunner: new MockShellRunner({
      passed: false,
      summary: "Shell command failed: custom validation",
      command: "custom validation",
      exit_code: 1,
      logs: "failed",
    }),
    artifactStore,
    traceRecorder,
    changeGate: new InMemoryChangeGate(),
  });

  const output = await runner.run(
    createContext(
      { project_path: "/tmp/project" },
      { validationCommand: "custom validation" },
    ),
  );

  assert.equal(output.artifacts.command, "custom validation");
  assert.equal(
    await artifactStore.getArtifact({
      taskId: "task-validation",
      stageId: "validation",
      filePath: "reports/validation/ValidationResult.json",
    }),
    JSON.stringify(output.artifacts, null, 2),
  );
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "validation_finished",
    "gate_reviewed",
    "artifact_persisted",
  ]);
}

function createContext(
  inputArtifacts: Record<string, string>,
  params?: Record<string, string>,
) {
  return {
    taskId: "task-validation",
    stageId: "validation",
    attempt: 1,
    workspaceRoot: "/tmp/validation-workspace",
    inputArtifacts,
    params,
  };
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class MockShellRunner extends ShellRunner {
  constructor(private readonly result: ShellResult) {
    super();
  }

  override async run(_command: string): Promise<ShellResult> {
    return this.result;
  }
}
