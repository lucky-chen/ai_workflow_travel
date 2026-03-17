import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArchitectureDesignContract } from "../../../src/Capability/ArchitectureDesign/architecture-design-contract.js";
import { ArchitectureDesignGenerator } from "../../../src/Capability/ArchitectureDesign/architecture-design-generator.js";
import { ArchitectureDesignRuntimeUnit } from "../../../src/Capability/ArchitectureDesign/architecture-design-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runArchitectureDesignCapabilityTests(): Promise<void> {
  await testArchitectureGeneratorReturnsDocumentAndBreakdown();
  await testArchitectureContractReportsMissingHeadings();
  await testArchitectureRuntimeUnitPersistsDocumentAndBreakdown();
}

async function testArchitectureGeneratorReturnsDocumentAndBreakdown(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-generator-");

  try {
    const content = [
      "# 1. Overview",
      "",
      "## 7.2 Design Document Breakdown",
      "- `sdlc/docs/item_design/Workflow.md`: Workflow item design baseline.",
      "",
    ].join("\n");
    const generator = new ArchitectureDesignGenerator({
      llmExecutor: createMockLlmExecutor(async () => ({
        content,
        responseFormat: "text",
      })),
    });
    const result = await generator.run(
      createExecutionContext(workspaceRoot, "architecture_design_generate", {
        requirement_design: "# Requirement\n",
      }),
    );

    assert.equal(result.executionUnitId, "architecture_design");
    assert.equal(result.success, true);
    assert.equal(result.summary, "Architecture design document generated.");
    assert.equal((result.artifacts as { artifactKey: string }).artifactKey, "architecture_design");
    assert.equal(
      JSON.parse((result.artifacts as { design_document_breakdown: string }).design_document_breakdown).length,
      1,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testArchitectureContractReportsMissingHeadings(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-contract-");

  try {
    const result = await new ArchitectureDesignContract().check(
      createExecutionContext(workspaceRoot, "architecture_design_contract"),
      {
        executionUnitId: "architecture_design",
        success: true,
        summary: "Loaded architecture design artifact for contract check.",
        artifacts: {
          artifactKey: "architecture_design",
          content: "# Technical Architecture\nOnly one short section.\n",
        },
      },
    );

    assert.equal(result.passed, false);
    assert.match(result.summary, /failed contract checks/i);
    assert.equal(
      result.issues.some((issue) => issue.message.includes("Missing required heading") || issue.message.includes("Missing required subsection")),
      true,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testArchitectureRuntimeUnitPersistsDocumentAndBreakdown(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-runtime-unit-");
  const storageRoot = await createTempDir("architecture-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Requirement Input\n",
      "utf8",
    );

    const generatedContent = [
      "# Technical Architecture",
      "",
      "## 7.2 Design Document Breakdown",
      "- `sdlc/docs/item_design/Workflow.md`: Workflow item design baseline.",
      "",
    ].join("\n");
    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new ArchitectureDesignRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => ({
        content: generatedContent,
        responseFormat: "text",
      })),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "architecture_design_generate",
      },
      {
        workspaceRoot,
        runId: "architecture-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.match(result.summary, /Architecture design document generated/);
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8"),
      generatedContent,
    );
    const breakdown = JSON.parse(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json"), "utf8"),
    ) as Array<{ documentPath: string }>;
    assert.equal(breakdown.length, 1);
    assert.equal(breakdown[0].documentPath, "sdlc/docs/item_design/Workflow.md");
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
