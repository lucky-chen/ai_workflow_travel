import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ArchitectureDesignGenerator } from "../../src/execution/architecture-design-generator/architecture-design-generator.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";

export async function runArchitectureDesignGeneratorTests(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-generator-");

  try {
    await testArchitectureDesignGeneratorBuildsPromptAndShapesOutput(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testArchitectureDesignGeneratorBuildsPromptAndShapesOutput(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# Technical Architecture\n\nGenerated architecture content.\n");
  const generator = new ArchitectureDesignGenerator({ llmExecutor });

  const output = await generator.run({
    taskId: "task-1",
    stageId: "architecture_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "# 1. Background\n\nRequirement content.\n",
    },
  });

  assert.deepEqual(output, {
    stageId: "architecture_design",
    success: true,
    summary: "Architecture design document generated.",
    artifacts: {
      artifactKey: "architecture_document",
      content: "# Technical Architecture\n\nGenerated architecture content.\n",
    },
  });

  assert.equal(llmExecutor.lastRequest?.responseFormat, "text");
  assert.equal(llmExecutor.lastRequest?.metadata?.stage, "architecture_design");
  assert.equal(llmExecutor.lastRequest?.prompt.systemPrompt.includes("technical architecture document"), true);

  const payload = JSON.parse(llmExecutor.lastRequest?.prompt.userPrompt ?? "{}") as {
    target: string;
    inputDocument: string;
    template: string;
  };
  assert.equal(payload.target, "architecture_design");
  assert.equal(payload.inputDocument.includes("Requirement content."), true);
  assert.equal(payload.template.includes("# Technical Architecture"), true);
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
    };
  }
}
