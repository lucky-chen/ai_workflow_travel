import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import type { StageDefinition, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";
import { continueAfterArchitectureDesign } from "../../src/workflow/pipeline/module-design-fanout.js";
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
        const descriptor = JSON.parse(context.inputArtifacts.module_descriptors) as { name: string };
        invocationOrder.push(descriptor.name);

        return {
          stageId: "module_design",
          status: "completed",
          success: true,
          summary: `Module design generated for ${descriptor.name}.`,
          artifacts: {
            artifactKey: "module_design_document",
            moduleName: descriptor.name,
            module_design_document: `docs/module_design/${descriptor.name}.md`,
            content: `# ${descriptor.name} Design`,
          },
        };
      },
    },
  };

  try {
    const result = await continueAfterArchitectureDesign(
      {
        currentStageId: "architecture_design",
        nextStageId: "module_design",
        taskId: "task-1",
        workspaceRoot,
        attempt: 1,
        params: undefined,
        currentInputArtifacts: {
          requirement_document: "docs/requirements/Requirement.md",
          architecture_document: "docs/architecture/TechnicalArchitecture.md",
        },
        stageOutput: {
          stageId: "architecture_design",
          status: "completed",
          success: true,
          summary: "Architecture generated.",
          artifacts: {
            artifactKey: "architecture_document",
            architecture_document: "docs/architecture/TechnicalArchitecture.md",
            content: createArchitectureDocument(),
          },
        },
        moduleStageDefinition,
      },
      {
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
        updateTaskAfterModuleRun: (context) => {
          updatedModuleInputs.push(context.inputArtifacts.module_descriptors);
        },
        onModuleStageFailure: async () => {
          throw new Error("unexpected failure");
        },
      },
    );

    assert.equal(result.matched, true);
    assert.equal(result.nextStageId, "implementation_plan");
    assert.deepEqual(invocationOrder, [
      "Interface Layer",
      "Workflow",
      "Execution",
      "Contract",
      "Quality Gate",
      "Data",
    ]);
    assert.equal(updatedModuleInputs.length, invocationOrder.length);
    assert.deepEqual(JSON.parse(result.nextInputArtifacts.module_design_documents), [
      "docs/module_design/Interface Layer.md",
      "docs/module_design/Workflow.md",
      "docs/module_design/Execution.md",
      "docs/module_design/Contract.md",
      "docs/module_design/Quality Gate.md",
      "docs/module_design/Data.md",
    ]);
    assert.equal("module_design_document" in result.nextInputArtifacts, false);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}
