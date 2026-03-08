import assert from "node:assert/strict";

import { RequirementGenerator } from "../src/execution/requirement-generator/requirement-generator.js";

export async function runRequirementGeneratorTests(): Promise<void> {
  await testRequirementGeneratorPassesThroughRequirementDocument();
}

async function testRequirementGeneratorPassesThroughRequirementDocument(): Promise<void> {
  const generator = new RequirementGenerator();
  const output = await generator.run({
    taskId: "task-1",
    stageId: "requirement_interpretation",
    attempt: 1,
    workspaceRoot: "/workspace/demo",
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
