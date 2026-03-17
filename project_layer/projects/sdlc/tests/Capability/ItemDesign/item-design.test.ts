import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ItemDesignContract } from "../../../src/Capability/ItemDesign/item-design-contract.js";
import { ItemDesignGenerator } from "../../../src/Capability/ItemDesign/item-design-generator.js";
import { ItemDesignRuntimeUnit } from "../../../src/Capability/ItemDesign/item-design-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runItemDesignCapabilityTests(): Promise<void> {
  await testItemDesignGeneratorReturnsGeneratedDocument();
  await testItemDesignContractReportsMissingStructure();
  await testItemDesignRuntimeUnitPersistsGeneratedDocument();
}

async function testItemDesignGeneratorReturnsGeneratedDocument(): Promise<void> {
  const workspaceRoot = await createTempDir("item-design-generator-");

  try {
    const generator = new ItemDesignGenerator({
      llmExecutor: createMockLlmExecutor(async () => ({
        content: "# Workflow Design\n\nGenerated item design content.\n",
        responseFormat: "text",
        metadata: {
          itemName: "Workflow",
          documentPath: "sdlc/docs/item_design/Workflow.md",
        },
      })),
    });

    const result = await generator.run(
      createExecutionContext(workspaceRoot, "item_design_generate", {
        architecture_design: "# Architecture\n",
        item_descriptors: JSON.stringify({
          name: "Workflow",
          responsibilities: ["define the hello function contract"],
          documentPath: "sdlc/docs/item_design/Workflow.md",
        }),
      }),
    );

    assert.equal(result.executionUnitId, "item_design");
    assert.equal(result.success, true);
    assert.equal(result.summary, 'Item design document generated for "Workflow".');
    assert.deepEqual(result.artifacts, {
      artifactKey: "item_design_document",
      moduleName: "Workflow",
      documentPath: "sdlc/docs/item_design/Workflow.md",
      content: "# Workflow Design\n\nGenerated item design content.\n",
    });
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testItemDesignContractReportsMissingStructure(): Promise<void> {
  const workspaceRoot = await createTempDir("item-design-contract-");

  try {
    const result = await new ItemDesignContract().check(
      createExecutionContext(workspaceRoot, "item_design_contract"),
      {
        executionUnitId: "item_design",
        success: true,
        summary: "Loaded item design artifact for contract check.",
        artifacts: {
          artifactKey: "item_design_document",
          moduleName: "Workflow",
          content: "# Workflow Design\nOnly one heading.\n",
        },
      },
    );

    assert.equal(result.passed, false);
    assert.match(result.summary, /failed contract checks/i);
    assert.equal(
      result.issues.some((issue) => issue.message.includes("Missing required section")),
      true,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testItemDesignRuntimeUnitPersistsGeneratedDocument(): Promise<void> {
  const workspaceRoot = await createTempDir("item-design-runtime-unit-");
  const storageRoot = await createTempDir("item-design-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    const descriptorPath = path.join(workspaceRoot, "tmp", "workflow-item.json");
    await mkdir(path.dirname(descriptorPath), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"),
      "# Architecture Input\n",
      "utf8",
    );
    await writeFile(
      descriptorPath,
      JSON.stringify({
        name: "Workflow",
        responsibilities: ["define the hello function contract"],
        documentPath: "sdlc/docs/item_design/Workflow.md",
        description: "Workflow item design baseline.",
      }),
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new ItemDesignRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => ({
        content: "# Workflow Design\n\nRuntime item design.\n",
        responseFormat: "text",
        metadata: {
          itemName: "Workflow",
          documentPath: "sdlc/docs/item_design/Workflow.md",
        },
      })),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "item_design_generate",
        params: {
          itemDescriptorPath: path.relative(workspaceRoot, descriptorPath),
        },
      },
      {
        workspaceRoot,
        runId: "item-design-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.match(result.summary, /Item design document generated/);
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "utf8"),
      "# Workflow Design\n\nRuntime item design.\n",
    );
    assert.equal(
      await readFile(
        path.join(
          storageRoot,
          "item-design-runtime-run",
          "item_design_generate",
          "sdlc",
          "docs",
          "item_design",
          "Workflow.md",
        ),
        "utf8",
      ),
      "# Workflow Design\n\nRuntime item design.\n",
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
