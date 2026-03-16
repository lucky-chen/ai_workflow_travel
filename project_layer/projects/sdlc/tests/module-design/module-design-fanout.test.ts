import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import type { StageContinuationContext, StageDefinition, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";
import { continueAfterArchitectureDesign } from "../../src/workflow/pipeline/module-design-fanout.js";
import {
  resolveArchitectureArtifactPath,
  resolveModuleDesignArtifactPath,
  resolveRequirementArtifactPath,
} from "../../src/workflow/stage-runners/stage-artifact-paths.js";
import { createArchitectureDocument, createTempDir } from "../workflow/pipeline-test-helpers.js";

export async function runModuleDesignFanoutTests(): Promise<void> {
  await testContinueAfterArchitectureDesignRunsSequentialModuleFanout();
}

async function testContinueAfterArchitectureDesignRunsSequentialModuleFanout(): Promise<void> {
  const workspaceRoot = await createTempDir("module-fanout-");
  const invocationOrder: string[] = [];
  const updatedModuleInputs: string[] = [];
  const moduleStageDefinition: StageDefinition = {
    stageId: "module_design",
    launchRequirements: ["architecture_document", "module_descriptors"],
    nextStageId: "implementation_plan",
    runner: {
      async run(context: StageRunContext): Promise<StageOutput> {
        const descriptor = JSON.parse(context.inputArtifacts.module_descriptors) as { name: string; documentPath?: string };
        invocationOrder.push(descriptor.name);

        return {
          stageId: "module_design",
          status: "completed",
          success: true,
          summary: `Item design generated for ${descriptor.name}.`,
          artifacts: {
            artifactKey: "item_design_document",
            moduleName: descriptor.name,
            documentPath: descriptor.documentPath ?? resolveModuleDesignArtifactPath(workspaceRoot, descriptor.name),
            item_design_document: descriptor.documentPath ?? resolveModuleDesignArtifactPath(workspaceRoot, descriptor.name),
            module_design_document: descriptor.documentPath ?? resolveModuleDesignArtifactPath(workspaceRoot, descriptor.name),
            content: `# ${descriptor.name} Design`,
          },
        };
      },
    },
  };

  try {
    const result = await continueAfterArchitectureDesign(
      {
        stageId: "architecture_design",
        nextStageId: "module_design",
        taskId: "task-1",
        workspaceRoot,
        attempt: 1,
        params: undefined,
        inputArtifacts: {
          requirement_document: resolveRequirementArtifactPath(workspaceRoot),
          architecture_document: resolveArchitectureArtifactPath(workspaceRoot),
        },
        stageOutput: {
          stageId: "architecture_design",
          status: "completed",
          success: true,
          summary: "Architecture generated.",
          artifacts: {
            artifactKey: "architecture_document",
            architecture_document: resolveArchitectureArtifactPath(workspaceRoot),
            content: createArchitectureDocument(),
            design_document_breakdown: JSON.stringify([
              {
                name: "Workflow",
                targetName: "Workflow",
                targetType: "item_design",
                documentPath: "sdlc/docs/module_design/Workflow.md",
                description: "covers the design of the `Workflow` module.",
                responsibilities: ["covers the design of the `Workflow` module."],
              },
              {
                name: "Data",
                targetName: "Data",
                targetType: "item_design",
                documentPath: "sdlc/docs/module_design/Data.md",
                description: "covers the design of the `Data` module.",
                responsibilities: ["covers the design of the `Data` module."],
              },
            ]),
          },
        },
        mergeInputArtifacts: (current, output) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(output.artifacts as Record<string, unknown>).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string" && !["artifactKey", "content", "summary", "moduleName"].includes(entry[0]),
            ),
          ),
        }),
        resolveStageStatus: (output) => (output.success ? "completed" : "failed"),
        updateTaskAfterStageRun: (context) => {
          updatedModuleInputs.push(context.inputArtifacts.module_descriptors);
        },
        onStageFailure: async () => {
          throw new Error("unexpected failure");
        },
      } satisfies StageContinuationContext,
      moduleStageDefinition,
    );

    assert.equal(result.nextStageId, "implementation_plan");
    assert.deepEqual(invocationOrder, [
      "Workflow",
      "Data",
    ]);
    assert.equal(updatedModuleInputs.length, invocationOrder.length);
    assert.deepEqual(JSON.parse(result.nextInputArtifacts.module_design_documents), [
      "sdlc/docs/module_design/Workflow.md",
      "sdlc/docs/module_design/Data.md",
    ]);
    assert.deepEqual(JSON.parse(result.nextInputArtifacts.item_design_documents), [
      "sdlc/docs/module_design/Workflow.md",
      "sdlc/docs/module_design/Data.md",
    ]);
    assert.equal("module_design_document" in result.nextInputArtifacts, false);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}
