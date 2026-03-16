import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { RequirementGenerator } from "../../src/execution/requirement-generator.js";
import {
  normalizePromptContent,
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";

export async function runRequirementGeneratorTests(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-generator-");

  try {
    await testRequirementGeneratorBuildsPromptAndShapesOutput(workspaceRoot);
    await testRequirementGeneratorSupportsUpdateExecutionUnit(workspaceRoot);
    await testRequirementGeneratorRequiresRequirementDocument(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRequirementGeneratorBuildsPromptAndShapesOutput(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# 1. Background\n\nGenerated requirement content.\n");
  const generator = new RequirementGenerator({ llmExecutor });

  const output = await generator.run({
    taskId: "task-1",
    stageId: "requirement_interpretation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "rough requirement input",
    },
  });

  assert.deepEqual(output, {
    stageId: "requirement_interpretation",
    success: true,
    summary: "Requirement document generated.",
    artifacts: {
      artifactKey: "requirement_document",
      content: "# 1. Background\n\nGenerated requirement content.\n",
    },
  });

  assert.equal(llmExecutor.lastRequest?.responseFormat, "text");
  assert.equal(llmExecutor.lastRequest?.metadata?.stage, "requirement_interpretation");
  assert.equal(
    normalizePromptContent(llmExecutor.lastRequest?.prompt.systemPrompt ?? "").includes("requirement document"),
    true,
  );

  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    target: string;
    inputDocument: string;
    template: string;
  };
  assert.equal(payload.target, "requirement_design_generate");
  assert.equal(payload.inputDocument, "rough requirement input");
  assert.equal(payload.template.includes("# 1. Background"), true);
}

async function testRequirementGeneratorSupportsUpdateExecutionUnit(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# 1. Background\n\nUpdated requirement content.\n");
  const generator = new RequirementGenerator({ llmExecutor });

  const output = await generator.run({
    taskId: "task-1-update",
    stageId: "requirement_interpretation",
    attempt: 1,
    workspaceRoot,
    params: {
      executionUnit: "requirement_design_update",
    },
    inputArtifacts: {
      requirement_document: "existing requirement input",
    },
  });

  assert.equal(output.summary, "Requirement document updated.");
  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    target: string;
  };
  assert.equal(payload.target, "requirement_design_update");
}

async function testRequirementGeneratorRequiresRequirementDocument(workspaceRoot: string): Promise<void> {
  const generator = new RequirementGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-2",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    }),
    /Missing required input artifact "requirement_document"\./,
  );
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class MockLlmExecutor implements ILlmExecutor {
  lastRequest?: LlmExecutionRequest;

  constructor(private readonly content: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    this.lastRequest = request;
    return {
      content: this.content,
      responseFormat: "text",
      metadata: request.metadata,
    };
  }
}
