import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArchitectureDesignContract } from "../../../src/Capability/ArchitectureDesign/architecture-design-contract.js";
import { ArchitectureDesignGenerator } from "../../../src/Capability/ArchitectureDesign/architecture-design-generator.js";
import {
  ArchitectureDesignGenerateRuntimeUnit,
  ArchitectureDesignUpdateRuntimeUnit,
} from "../../../src/Capability/ArchitectureDesign/architecture-design-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runArchitectureDesignCapabilityTests(): Promise<void> {
  await testArchitectureGeneratorReturnsDocumentAndBreakdown();
  await testArchitectureGeneratorOmitsCurrentDocumentForGenerate();
  await testArchitectureContractReportsMissingHeadings();
  await testArchitectureContractRequiresBreakdownJsonToCoverReferencedDocuments();
  await testArchitectureGenerateRuntimeUnitPersistsDocumentAndBreakdown();
  await testArchitectureUpdateRuntimeUnitLoadsCurrentDocument();
}

async function testArchitectureGeneratorReturnsDocumentAndBreakdown(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-generator-");

  try {
    let capturedRequest:
      | {
          prompt: { userPrompt: unknown };
        }
      | undefined;
    const content = [
      "# 1. Overview",
      "",
      "## 7.2 Design Document Breakdown",
      "- `sdlc/docs/item_design/Workflow.md`: Workflow item design baseline.",
      "",
    ].join("\n");
    const generator = new ArchitectureDesignGenerator({
      llmExecutor: createMockLlmExecutor(async (request) => {
        capturedRequest = request;
        return {
          content,
          responseFormat: "text",
        };
      }),
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
    const userPrompt = capturedRequest?.prompt.userPrompt as Record<string, unknown> | undefined;
    assert.equal(typeof userPrompt?.template, "string");
    assert.equal(typeof userPrompt?.templateContract, "object");
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testArchitectureGeneratorOmitsCurrentDocumentForGenerate(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-generator-generate-no-current-");

  try {
    let capturedRequest:
      | {
          prompt: { userPrompt: unknown };
        }
      | undefined;
    const generator = new ArchitectureDesignGenerator({
      llmExecutor: createMockLlmExecutor(async (request) => {
        capturedRequest = request;
        return {
          content: "# Technical Architecture\n",
          responseFormat: "text",
        };
      }),
    });

    await generator.run(
      createExecutionContext(workspaceRoot, "architecture_design_generate", {
        requirement_design: "# Requirement\n",
        architecture_design: "# Existing Architecture\n",
      }),
    );

    const userPrompt = capturedRequest?.prompt.userPrompt as Record<string, unknown> | undefined;
    assert.equal(userPrompt?.target, "architecture_design_generate");
    assert.equal("currentArchitectureDocument" in (userPrompt ?? {}), false);
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
      result.issues.some((issue) => issue.message.includes("Missing required section")),
      true,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testArchitectureContractRequiresBreakdownJsonToCoverReferencedDocuments(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-contract-breakdown-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json"),
      JSON.stringify([], null, 2),
      "utf8",
    );

    const content = [
      "# Technical Architecture",
      "",
      "## 1. Purpose",
      "",
      "Define the overall technical architecture of the `hello-service` platform.",
      "",
      "- Team members: provide a shared high-level baseline for the team.",
      "- Senior engineers: review architecture direction and boundaries.",
      "- Junior engineers: understand system and module structure for later design and implementation.",
      "",
      "## 2. Scope",
      "",
      "### 2.1 In Scope",
      "",
      "- Overall system interaction and control flow at architecture level.",
      "",
      "### 2.2 Out of Scope",
      "",
      "- Detailed module internals and implementation logic.",
      "",
      "## 3. Design Drivers",
      "",
      "- Driver A",
      "",
      "# 4. Architecture Design",
      "",
      "### 4.1 Architecture Style",
      "",
      "The system adopts a `modular monolith` architecture.",
      "",
      "### 4.2 Layers or Partitions",
      "",
      "- `InterfaceLayer`: request entry",
      "- `ApplicationLayer`: business orchestration",
      "- `DataLayer`: persistence boundary",
      "",
      "### 4.3 Allowed Dependencies",
      "",
      "ALLOW:",
      "- `InterfaceLayer` -> `ApplicationLayer`",
      "- `ApplicationLayer` -> `DataLayer`",
      "",
      "### 4.4 High-level Diagram",
      "",
      "```text",
      "[High-level architecture diagram here]",
      "```",
      "",
      "### 4.5 Runtime Topology",
      "",
      "- `RuntimeNodeA`: role a",
      "",
      "### 4.6 Technology Choices",
      "",
      "- `InterfaceLayer`: `Node.js` for request handling",
      "",
      "## 5. System Interactions",
      "",
      "### 5.1 Primary Interaction Path",
      "",
      "```text",
      "[Main flow diagram here]",
      "```",
      "",
      "1. `Step1`",
      "",
      "`FlowSummary`",
      "",
      "### 5.2 Core Modules",
      "",
      "- **`LayerOrPartitionA`**",
      "  - `ModuleA`",
      "    - responsibility: `ResponsibilityA`",
      "",
      "### 5.3 Interaction Model",
      "",
      "This section describes high-level cross-module interaction.",
      "",
      "### 5.4 Key Considerations",
      "",
      "- `ImportantConsideration1`",
      "",
      "## 6. Non-Functional Considerations",
      "",
      "### 6.1 High Availability",
      "",
      "- Why it matters:",
      "  - `Reason1`",
      "- Architectural support:",
      "  - `Support1`",
      "",
      "### 6.2 High Scalability",
      "",
      "- Why it matters:",
      "  - `Reason1`",
      "- Architectural support:",
      "  - `Support1`",
      "",
      "### 6.3 High Performance",
      "",
      "- Why it matters:",
      "  - `Reason1`",
      "- Architectural support:",
      "  - `Support1`",
      "",
      "## 7. Design Documents",
      "",
      "### 7.1 Design Document Categories",
      "",
      "- `CategoryA`",
      "- `CategoryB`",
      "- `CategoryC`",
      "",
      "### 7.2 Design Document Breakdown",
      "",
      "- [workflow_design](sdlc/docs/item_design/Workflow.md): covers Workflow.",
      "",
      "## 8. Open Issues",
      "",
      "- `OpenIssue1`",
      "",
    ].join("\n");

    const result = await new ArchitectureDesignContract().check(
      createExecutionContext(workspaceRoot, "architecture_design_contract"),
      {
        executionUnitId: "architecture_design",
        success: true,
        summary: "Loaded architecture design artifact for contract check.",
        artifacts: {
          artifactKey: "architecture_design",
          content,
        },
      },
    );

    assert.equal(result.passed, false);
    assert.equal(
      result.issues.some((issue) => issue.message.includes("architecture_design_breakdown.json is missing documentPath entries")),
      true,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testArchitectureGenerateRuntimeUnitPersistsDocumentAndBreakdown(): Promise<void> {
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
    const runtimeUnit = new ArchitectureDesignGenerateRuntimeUnit(
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
    await assert.rejects(
      readFile(path.join(storageRoot, "architecture-runtime-run", "sdlc", "docs", "TechnicalArchitecture.md"), "utf8"),
      (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT",
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}

async function testArchitectureUpdateRuntimeUnitLoadsCurrentDocument(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-update-runtime-unit-");
  const storageRoot = await createTempDir("architecture-update-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"),
      "# Requirement Input\n",
      "utf8",
    );
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"),
      "# Existing Architecture\n",
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new ArchitectureDesignUpdateRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => {
        throw new Error("Architecture update runtime unit must not call llmExecutor.");
      }),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "architecture_design_update",
      },
      {
        workspaceRoot,
        runId: "architecture-update-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.deepEqual(result.externalAction, {
      tool: "external_plugin",
      operation: "update_markdown",
      targetPath: "sdlc/docs/TechnicalArchitecture.md",
      payload: {
        prompt: [
          "Update the existing technical architecture markdown document.",
          "",
          "Requirement document:",
          "# Requirement Input",
          "",
          "Current architecture document:",
          "# Existing Architecture",
          "",
          "Return one markdown-only update instruction for an external editor.",
          "Keep the architecture aligned with the requirement document, template structure, and contract requirements.",
          "Do not apply the change directly.",
        ].join("\n"),
      },
    });
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8"),
      "# Existing Architecture\n",
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(storageRoot, "architecture-update-runtime-run", "architecture_design_update_result.json"),
          "utf8",
        ),
      ).prompt,
      [
        "Update the existing technical architecture markdown document.",
        "",
        "Requirement document:",
        "# Requirement Input",
        "",
        "Current architecture document:",
        "# Existing Architecture",
        "",
        "Return one markdown-only update instruction for an external editor.",
        "Keep the architecture aligned with the requirement document, template structure, and contract requirements.",
        "Do not apply the change directly.",
      ].join("\n"),
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
