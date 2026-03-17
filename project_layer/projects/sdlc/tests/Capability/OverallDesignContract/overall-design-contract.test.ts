import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { OverallDesignContract } from "../../../src/Capability/OverallDesignContract/overall-design-contract.js";
import { OverallDesignContractRuntimeUnit } from "../../../src/Capability/OverallDesignContract/overall-design-contract-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runOverallDesignContractCapabilityTests(): Promise<void> {
  await testOverallDesignContractPassesForAlignedArtifacts();
  await testOverallDesignContractReportsMissingBreakdownCoverage();
  await testOverallDesignContractRuntimeUnitPersistsResult();
}

async function testOverallDesignContractPassesForAlignedArtifacts(): Promise<void> {
  const workspaceRoot = await createTempDir("overall-design-contract-");

  try {
    const artifacts = {
      requirement_design: "# Requirement\n",
      architecture_design: "# Technical Architecture\n",
      architecture_design_breakdown: JSON.stringify([
        { documentPath: "sdlc/docs/item_design/Workflow.md" },
      ]),
      item_design_documents: JSON.stringify([
        {
          path: "sdlc/docs/item_design/Workflow.md",
          content: "# Workflow Item Design\n",
        },
      ]),
    };
    const result = await new OverallDesignContract().check(
      createExecutionContext(workspaceRoot, "overall_design_contract", artifacts),
      {
        executionUnitId: "overall_design_contract",
        success: true,
        summary: "Loaded overall design artifacts for contract check.",
        artifacts,
      },
    );

    assert.equal(result.passed, true);
    assert.match(result.summary, /passed/i);
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testOverallDesignContractReportsMissingBreakdownCoverage(): Promise<void> {
  const workspaceRoot = await createTempDir("overall-design-contract-mismatch-");

  try {
    const artifacts = {
      requirement_design: "# Requirement\n",
      architecture_design: "# Technical Architecture\n",
      architecture_design_breakdown: JSON.stringify([
        { documentPath: "sdlc/docs/item_design/Workflow.md" },
      ]),
      item_design_documents: JSON.stringify([
        {
          path: "sdlc/docs/item_design/Api.md",
          content: "# Api Item Design\n",
        },
      ]),
    };
    const result = await new OverallDesignContract().check(
      createExecutionContext(workspaceRoot, "overall_design_contract", artifacts),
      {
        executionUnitId: "overall_design_contract",
        success: true,
        summary: "Loaded overall design artifacts for contract check.",
        artifacts,
      },
    );

    assert.equal(result.passed, false);
    assert.equal(
      result.issues.some((issue) => issue.checkItem === "overall_design_breakdown_coverage"),
      true,
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testOverallDesignContractRuntimeUnitPersistsResult(): Promise<void> {
  const workspaceRoot = await createTempDir("overall-design-runtime-unit-");
  const storageRoot = await createTempDir("overall-design-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs", "item_design"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "# Requirement\n", "utf8");
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "# Architecture\n", "utf8");
    await writeFile(
      path.join(workspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json"),
      JSON.stringify([{ documentPath: "sdlc/docs/item_design/Workflow.md" }], null, 2),
      "utf8",
    );
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "# Workflow\n", "utf8");

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new OverallDesignContractRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "overall_design_contract",
      },
      {
        workspaceRoot,
        runId: "overall-design-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.match(result.summary, /overall design contract passed/i);
    const persisted = JSON.parse(
      await readFile(path.join(storageRoot, "overall-design-run", "overall_design_contract_result.json"), "utf8"),
    ) as { passed: boolean };
    assert.equal(persisted.passed, true);
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}
