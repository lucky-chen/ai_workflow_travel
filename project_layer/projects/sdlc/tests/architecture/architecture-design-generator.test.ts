import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArchitectureDesignGenerator } from "../../src/execution/architecture-design-generator/architecture-design-generator.js";
import {
  normalizePromptContent,
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";

export async function runArchitectureDesignGeneratorTests(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-generator-");

  try {
    await testArchitectureDesignGeneratorBuildsPromptAndShapesOutput(workspaceRoot);
    await testArchitectureDesignGeneratorPrefersWorkspaceTemplate(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testArchitectureDesignGeneratorBuildsPromptAndShapesOutput(workspaceRoot: string): Promise<void> {
  const generatedArchitectureDocument = [
    "# Technical Architecture",
    "",
    "## 7.2 Design Document Breakdown",
    "- `sdlc/docs/module_design/Workflow.md`: covers the design of the `Workflow` module.",
    "- `sdlc/docs/module_design/Data.md`: covers the design of the `Data` module.",
    "",
  ].join("\n");
  const llmExecutor = new MockLlmExecutor(generatedArchitectureDocument);
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
      content: generatedArchitectureDocument,
      design_document_breakdown: JSON.stringify([
        {
          name: "Workflow",
          documentPath: "sdlc/docs/module_design/Workflow.md",
          description: "covers the design of the `Workflow` module.",
          responsibilities: ["covers the design of the `Workflow` module."],
        },
        {
          name: "Data",
          documentPath: "sdlc/docs/module_design/Data.md",
          description: "covers the design of the `Data` module.",
          responsibilities: ["covers the design of the `Data` module."],
        },
      ]),
    },
  });

  assert.equal(llmExecutor.lastRequest?.responseFormat, "text");
  assert.equal(llmExecutor.lastRequest?.metadata?.stage, "architecture_design");
  assert.equal(
    normalizePromptContent(llmExecutor.lastRequest?.prompt.systemPrompt ?? "").includes("technical architecture document"),
    true,
  );
  assert.equal(Array.isArray(llmExecutor.lastRequest?.prompt.systemPrompt), true);
  assert.equal(typeof llmExecutor.lastRequest?.prompt.userPrompt, "object");

  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    target: string;
    inputDocument: string;
    template: string;
  };
  assert.equal(payload.target, "architecture_design");
  assert.equal(payload.inputDocument.includes("Requirement content."), true);
  assert.equal(payload.template.includes("# Technical Architecture"), true);
}

async function testArchitectureDesignGeneratorPrefersWorkspaceTemplate(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# Technical Architecture\n\nGenerated architecture content.\n");
  const generator = new ArchitectureDesignGenerator({ llmExecutor });
  const templatePath = path.join(workspaceRoot, "sdlc", "resources", "template", "TechnicalArchitectureTemplate.md");
  await mkdir(path.dirname(templatePath), { recursive: true });
  await writeFile(templatePath, "# Workspace Technical Architecture Template\n", "utf8");

  await generator.run({
    taskId: "task-2",
    stageId: "architecture_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "# 1. Background\n\nRequirement content.\n",
    },
  });

  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    template: string;
  };
  assert.equal(payload.template, "# Workspace Technical Architecture Template\n");
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
