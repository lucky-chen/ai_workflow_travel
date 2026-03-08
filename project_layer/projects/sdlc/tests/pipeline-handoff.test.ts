import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { ArchitectureStageRunner } from "../src/workflow/stage-runners/architecture-stage-runner.js";
import { RequirementStageRunner } from "../src/workflow/stage-runners/requirement-stage-runner.js";
import { InMemoryTraceRecorder } from "../src/quality-gate/trace/trace-recorder.js";
import { PipelineService } from "../src/workflow/pipeline/pipeline.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";
import {
  MockTextLlmExecutor,
  createArchitectureDocument,
  createRegistry,
  createRequirementDocument,
  createTempDir,
} from "./pipeline-test-helpers.js";

export async function runPipelineHandoffTests(workspaceRoot: string): Promise<void> {
  await testRequirementStageHandoffIntoArchitectureStage(workspaceRoot);
}

async function testRequirementStageHandoffIntoArchitectureStage(workspaceRoot: string): Promise<void> {
  const storageRoot = await createTempDir("pipeline-requirement-");
  const artifactStore = new ArtifactStoreService(storageRoot);
  const traceRecorder = new InMemoryTraceRecorder();
  const invocationContexts: StageRunContext[] = [];
  const moduleDesignStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      invocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Module design stage completed.",
        artifacts: {},
      };
    },
  };

  try {
    const pipeline = new PipelineService({
      traceRecorder,
      registry: createRegistry(
        {
          stageId: "requirement_interpretation",
          launchRequirements: ["requirement_document"],
          runner: new RequirementStageRunner({ artifactStore, traceRecorder }),
          nextStageId: "architecture_design",
        },
        {
          stageId: "architecture_design",
          launchRequirements: ["requirement_document"],
          runner: new ArchitectureStageRunner({
            llmExecutor: new MockTextLlmExecutor(createArchitectureDocument()),
            artifactStore,
            traceRecorder,
          }),
          nextStageId: "module_design",
        },
        {
          stageId: "module_design",
          launchRequirements: ["architecture_document"],
          runner: moduleDesignStage,
          nextStageId: null,
        },
      ),
    });

    const taskId = await pipeline.launchTask({
      startStageId: "requirement_interpretation",
      workspaceRoot,
      inputArtifacts: {
        requirement_document: createRequirementDocument(),
      },
    });

    assert.equal(invocationContexts.length, 1);
    assert.deepEqual(invocationContexts[0], {
      taskId,
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: "docs/requirements/Requirement.md",
        architecture_document: "docs/architecture/TechnicalArchitecture.md",
      },
      params: undefined,
    });
    assert.equal(
      await artifactStore.getArtifact({
        taskId,
        stageId: "architecture_design",
        filePath: "docs/architecture/TechnicalArchitecture.md",
      }),
      createArchitectureDocument(),
    );
    assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
      "task_started",
      "stage_started",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "task_finished",
    ]);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}
