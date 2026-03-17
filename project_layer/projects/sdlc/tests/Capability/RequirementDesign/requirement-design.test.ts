import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { RequirementContract } from "../../../src/Capability/RequirementDesign/requirement-contract.js";
import { RequirementGenerator } from "../../../src/Capability/RequirementDesign/requirement-generator.js";
import { RequirementDesignRuntimeUnit } from "../../../src/Capability/RequirementDesign/requirement-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runRequirementDesignCapabilityTests(): Promise<void> {
  await testRequirementGeneratorReturnsGeneratedDocument();
  await testRequirementContractReportsMissingSections();
  await testRequirementRuntimeUnitPersistsGeneratedDocument();
}

async function testRequirementGeneratorReturnsGeneratedDocument(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-generator-");

  try {
    let capturedRequest:
      | {
          prompt: { userPrompt: unknown };
        }
      | undefined;
    const generator = new RequirementGenerator({
      llmExecutor: createMockLlmExecutor(async (request) => {
        capturedRequest = request;
        return {
        content: "# Generated Requirement\n\n- generated content\n",
        responseFormat: "text",
        };
      }),
    });
    const result = await generator.run(
      {
        ...createExecutionContext(workspaceRoot, "requirement_design_generate"),
        params: {
          executionUnit: "requirement_design_generate",
          userComment: "Generate requirement baseline from user comment.",
        },
      },
    );

    assert.equal(result.executionUnitId, "requirement_design");
    assert.equal(result.success, true);
    assert.equal(result.summary, "Requirement document generated.");
    assert.deepEqual(result.artifacts, {
      artifactKey: "requirement_design",
      content: "# Generated Requirement\n\n- generated content\n",
    });
    const userPrompt = capturedRequest?.prompt.userPrompt as Record<string, unknown> | undefined;
    assert.equal(userPrompt?.target, "requirement_design_generate");
    assert.equal(userPrompt?.userComment, "Generate requirement baseline from user comment.");
    assert.equal(typeof userPrompt?.template, "string");
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testRequirementContractReportsMissingSections(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-contract-");

  try {
    const result = await new RequirementContract().check(
      createExecutionContext(workspaceRoot, "requirement_design_contract"),
      {
        executionUnitId: "requirement_design",
        success: true,
        summary: "Loaded requirement design artifact for contract check.",
        artifacts: {
          artifactKey: "requirement_design",
          content: "# 1. Background\nOnly one section.\n",
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

async function testRequirementRuntimeUnitPersistsGeneratedDocument(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-runtime-unit-");
  const storageRoot = await createTempDir("requirement-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Existing Requirement\n",
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new RequirementDesignRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => ({
        content: "# Runtime Requirement\n\n- persisted content\n",
        responseFormat: "text",
      })),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "requirement_design_generate",
        params: {
          userComment: "Generate runtime requirement from comment.",
        },
      },
      {
        workspaceRoot,
        runId: "requirement-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.match(result.summary, /Requirement document generated/);
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8"),
      "# Runtime Requirement\n\n- persisted content\n",
    );
    await assert.rejects(
      readFile(
        path.join(
          storageRoot,
          "requirement-runtime-run",
          "sdlc",
          "docs",
          "Requirement.md",
        ),
        "utf8",
      ),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT",
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
