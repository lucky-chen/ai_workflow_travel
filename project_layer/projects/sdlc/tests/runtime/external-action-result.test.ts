import assert from "node:assert/strict";

import { ingestExternalActionResult } from "../../src/Runtime/external-action-result.js";

export async function runExternalActionResultTests(): Promise<void> {
  await testExternalActionResultUsesResumeInputWhenProvided();
  await testExternalActionResultFallsBackToUpdatedArtifacts();
}

async function testExternalActionResultUsesResumeInputWhenProvided(): Promise<void> {
  const ingested = ingestExternalActionResult({
    status: "success",
    targetPath: "/tmp/workspace",
    changedFiles: [
      { path: "src/index.ts", operation: "update", content: "export const value = true;\n" },
    ],
    updatedArtifacts: [
      { artifactKey: "requirement_design", filePath: "sdlc/docs/Requirement.md", content: "# Requirement\n" },
    ],
    resumeInput: {
      requirement_design: "# Resume Requirement\n",
      work_plan: "version: 2\n",
    },
  });

  assert.deepEqual(ingested.refreshedArtifacts, {
    requirement_design: "# Resume Requirement\n",
    work_plan: "version: 2\n",
  });
}

async function testExternalActionResultFallsBackToUpdatedArtifacts(): Promise<void> {
  const ingested = ingestExternalActionResult({
    status: "success",
    targetPath: "/tmp/workspace",
    updatedArtifacts: [
      { artifactKey: "architecture_design", filePath: "sdlc/docs/TechnicalArchitecture.md", content: "# Architecture\n" },
      { artifactKey: "work_plan", filePath: "sdlc/docs/work_plan.yaml" },
    ],
  });

  assert.deepEqual(ingested.refreshedArtifacts, {
    architecture_design: "# Architecture\n",
    work_plan: "sdlc/docs/work_plan.yaml",
  });
}
