import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { RequirementContract } from "../../../src/Capability/RequirementDesign/requirement-contract.js";
import { RequirementGenerator, RequirementDesignGenerateRuntimeUnit } from "../../../src/Capability/RequirementDesign/requirement-generator.js";
import { RequirementDesignUpdateRuntimeUnit } from "../../../src/Capability/RequirementDesign/requirement-update-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runRequirementDesignCapabilityTests(): Promise<void> {
  await testRequirementGeneratorReturnsGeneratedDocument();
  await testRequirementGeneratorOmitsExistingRequirementForGenerate();
  await testRequirementContractReportsMissingSections();
  await testRequirementGenerateRuntimeUnitPersistsGeneratedDocument();
  await testRequirementUpdateRuntimeUnitLoadsCurrentDocument();
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
    assert.equal(typeof userPrompt?.templateContract, "object");
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testRequirementGeneratorOmitsExistingRequirementForGenerate(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-generator-generate-no-existing-");

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
          content: "# Generated Requirement\n",
          responseFormat: "text",
        };
      }),
    });

    await generator.run({
      ...createExecutionContext(workspaceRoot, "requirement_design_generate", {
        requirement_design: "# Existing Requirement\n",
      }),
      params: {
        executionUnit: "requirement_design_generate",
        userComment: "Generate requirement baseline from user comment.",
      },
    });

    const userPrompt = capturedRequest?.prompt.userPrompt as Record<string, unknown> | undefined;
    assert.equal("existingRequirement" in (userPrompt ?? {}), false);
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

async function testRequirementGenerateRuntimeUnitPersistsGeneratedDocument(): Promise<void> {
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
    const runtimeUnit = new RequirementDesignGenerateRuntimeUnit(
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

async function testRequirementUpdateRuntimeUnitLoadsCurrentDocument(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-update-runtime-unit-");
  const storageRoot = await createTempDir("requirement-update-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Existing Requirement\n\n- keep this as update input\n",
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new RequirementDesignUpdateRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => {
        throw new Error("Requirement update runtime unit must not call llmExecutor.");
      }),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "requirement_design_update",
        params: {
          userComment: "Update current requirement from comment.",
        },
      },
      {
        workspaceRoot,
        runId: "requirement-update-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.deepEqual(result.externalAction, {
      tool: "external_plugin",
      operation: "update_markdown",
      targetPath: "sdlc/docs/Requirement.md",
      payload: {
        prompt: [
          "Update the existing requirement markdown document.",
          "",
          "User request:",
          "Update current requirement from comment.",
          "",
          "Current requirement document:",
          "# Existing Requirement\n\n- keep this as update input",
          "",
          "Return one markdown-only update instruction for an external editor.",
          "Keep the document aligned with the existing template structure and contract requirements.",
          "Do not apply the change directly.",
        ].join("\n"),
      },
    });
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8"),
      "# Existing Requirement\n\n- keep this as update input\n",
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(storageRoot, "requirement-update-runtime-run", "requirement_design_update_result.json"),
          "utf8",
        ),
      ).prompt,
      [
        "Update the existing requirement markdown document.",
        "",
        "User request:",
        "Update current requirement from comment.",
        "",
        "Current requirement document:",
        "# Existing Requirement\n\n- keep this as update input",
        "",
        "Return one markdown-only update instruction for an external editor.",
        "Keep the document aligned with the existing template structure and contract requirements.",
        "Do not apply the change directly.",
      ].join("\n"),
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
