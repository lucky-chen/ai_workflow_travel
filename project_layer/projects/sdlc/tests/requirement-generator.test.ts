import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { RequirementGenerator } from "../src/execution/requirement-generator/requirement-generator.js";

export async function runRequirementGeneratorTests(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-generator-");

  try {
    await testRequirementGeneratorPassesThroughRequirementDocument(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRequirementGeneratorPassesThroughRequirementDocument(workspaceRoot: string): Promise<void> {
  const generator = new RequirementGenerator();
  const output = await generator.run({
    taskId: "task-1",
    stageId: "requirement_interpretation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "# 1. Background\n\n# 2. User Scenarios\n",
    },
  });

  assert.deepEqual(output, {
    stageId: "requirement_interpretation",
    success: true,
    summary: "Requirement document loaded.",
    artifacts: {
      artifactKey: "requirement_document",
      content: "# 1. Background\n\n# 2. User Scenarios\n",
    },
  });
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}
