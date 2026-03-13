import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ModuleDesignGenerator } from "../../src/execution/module-design-generator.js";
import {
  normalizePromptContent,
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";

export async function runModuleDesignGeneratorTests(): Promise<void> {
  const workspaceRoot = await createTempDir("module-generator-");

  try {
    await testModuleDesignGeneratorBuildsPromptAndShapesOutput(workspaceRoot);
    await testModuleDesignGeneratorRequiresArchitectureDocument(workspaceRoot);
    await testModuleDesignGeneratorRequiresModuleDescriptor(workspaceRoot);
    await testModuleDesignGeneratorRejectsInvalidModuleDescriptorJson(workspaceRoot);
    await testModuleDesignGeneratorRejectsInvalidModuleDescriptorShape(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testModuleDesignGeneratorBuildsPromptAndShapesOutput(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# Workflow Design\n\nGenerated module design content.\n");
  const generator = new ModuleDesignGenerator({ llmExecutor });

  const output = await generator.run({
    taskId: "task-1",
    stageId: "module_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      architecture_document: "# Technical Architecture\n\nArchitecture content.\n",
      module_descriptors: JSON.stringify({
        name: "Workflow",
        documentPath: "sdlc/docs/module_design/Workflow.md",
        description: "covers the design of the `Workflow` module.",
        responsibilities: ["orchestrate stage execution", "coordinate stage handoff"],
      }),
    },
  });

  assert.deepEqual(output, {
    stageId: "module_design",
    success: true,
    summary: 'Module design document generated for "Workflow".',
    artifacts: {
      artifactKey: "module_design_document",
      moduleName: "Workflow",
      documentPath: "sdlc/docs/module_design/Workflow.md",
      content: "# Workflow Design\n\nGenerated module design content.\n",
    },
  });

  assert.equal(llmExecutor.lastRequest?.responseFormat, "text");
  assert.equal(llmExecutor.lastRequest?.metadata?.stage, "module_design");
  assert.equal(llmExecutor.lastRequest?.metadata?.moduleName, "Workflow");
  assert.equal(
    normalizePromptContent(llmExecutor.lastRequest?.prompt.systemPrompt ?? "").includes("module design document"),
    true,
  );
  assert.equal(
    normalizePromptContent(llmExecutor.lastRequest?.prompt.systemPrompt ?? "").includes("generator internals"),
    true,
  );

  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    target: string;
    architectureDocument: string;
    moduleDescriptor: { name: string; responsibilities: string[]; documentPath?: string };
    templateRules: { document_contracts: Array<{ check_item: string }>; section_contracts: Array<{ section_id: string; checkitems: string[] }> };
    templateSkeleton: string;
  };
  assert.equal(payload.target, "module_design");
  assert.equal(payload.architectureDocument.includes("Architecture content."), true);
  assert.equal(payload.moduleDescriptor.name, "Workflow");
  assert.equal(payload.moduleDescriptor.documentPath, "sdlc/docs/module_design/Workflow.md");
  assert.equal(payload.moduleDescriptor.responsibilities.length, 2);
  assert.equal(payload.templateRules.document_contracts.length > 0, true);
  assert.equal(payload.templateRules.section_contracts.some((entry) => entry.section_id === "4.1.2"), true);
  assert.equal(
    payload.templateRules.section_contracts.some(
      (entry) => entry.section_id === "1.1"
        && entry.checkitems.some((item) => item.includes("keep the purpose concise"))
        && !entry.checkitems.some((item) => item.includes("inline-markdown format")),
    ),
    true,
  );
  assert.equal(
    payload.templateRules.section_contracts.some(
      (entry) => entry.section_id === "1.3"
        && entry.checkitems.some((item) => item.includes("current design item identity")),
    ),
    true,
  );
  assert.equal(
    payload.templateRules.section_contracts.some(
      (entry) => entry.section_id === "4.1.1"
        && entry.checkitems.some((item) => item.includes("actual exposed boundary or contract surface")),
    ),
    true,
  );
  assert.equal(
    payload.templateRules.section_contracts.some(
      (entry) => entry.section_id === "4.1.2"
        && entry.checkitems.some((item) => item.includes("short code comments are optional"))
        && entry.checkitems.some((item) => item.includes("do not add explanatory prose before or after the code block")),
    ),
    true,
  );
  assert.equal(
    payload.templateRules.section_contracts.some(
      (entry) => entry.section_id === "4.1.4"
        && entry.checkitems.some((item) => item.includes("short code comments are optional"))
        && entry.checkitems.some((item) => item.includes("do not add explanatory prose before or after the code block")),
    ),
    true,
  );
  assert.equal(payload.templateSkeleton.includes("# {ModuleName} Design"), true);
  assert.equal(payload.templateSkeleton.includes("document_contracts"), false);
  assert.equal(payload.templateSkeleton.includes("section_contract"), false);
}

async function testModuleDesignGeneratorRequiresArchitectureDocument(workspaceRoot: string): Promise<void> {
  const generator = new ModuleDesignGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-2",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        module_descriptors: JSON.stringify({ name: "Workflow", responsibilities: ["orchestrate"] }),
      },
    }),
    /Missing required input artifact "architecture_document"\./,
  );
}

async function testModuleDesignGeneratorRequiresModuleDescriptor(workspaceRoot: string): Promise<void> {
  const generator = new ModuleDesignGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-3",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        architecture_document: "# Technical Architecture",
      },
    }),
    /Missing required input artifact "module_descriptors"\./,
  );
}

async function testModuleDesignGeneratorRejectsInvalidModuleDescriptorJson(workspaceRoot: string): Promise<void> {
  const generator = new ModuleDesignGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-4",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        architecture_document: "# Technical Architecture",
        module_descriptors: "{invalid-json",
      },
    }),
    /Input artifact "module_descriptors" must be valid JSON\./,
  );
}

async function testModuleDesignGeneratorRejectsInvalidModuleDescriptorShape(workspaceRoot: string): Promise<void> {
  const generator = new ModuleDesignGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-5",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        architecture_document: "# Technical Architecture",
        module_descriptors: JSON.stringify([{ name: "Workflow", responsibilities: ["orchestrate"] }]),
      },
    }),
    /Input artifact "module_descriptors" must contain exactly one valid ModuleDescriptor\./,
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
      metadata: {
        ...(request.metadata ?? {}),
      },
    };
  }
}
