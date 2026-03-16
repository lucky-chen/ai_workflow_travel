import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ImplementationPlanGenerator } from "../../src/execution/implementation-plan-generator.js";
import {
  normalizePromptContent,
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";
import {
  resolveArchitectureArtifactPath,
  resolveModuleDesignArtifactPath,
  resolveRequirementArtifactPath,
} from "../../src/workflow/stage-runners/stage-artifact-paths.js";

export async function runImplementationPlanGeneratorTests(): Promise<void> {
  const workspaceRoot = await createTempDir("implementation-plan-generator-");

  try {
    await testImplementationPlanGeneratorBuildsPromptAndShapesOutput(workspaceRoot);
    await testImplementationPlanGeneratorSupportsUpdateExecutionUnit(workspaceRoot);
    await testImplementationPlanGeneratorRequiresRequirementDocument(workspaceRoot);
    await testImplementationPlanGeneratorRequiresArchitectureDocument(workspaceRoot);
    await testImplementationPlanGeneratorRequiresModuleDesignDocuments(workspaceRoot);
    await testImplementationPlanGeneratorRejectsInvalidModuleDesignDocumentsJson(workspaceRoot);
    await testImplementationPlanGeneratorRejectsInvalidModuleDesignDocumentsShape(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testImplementationPlanGeneratorBuildsPromptAndShapesOutput(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# Work Plan\n\nGenerated plan content.\n");
  const generator = new ImplementationPlanGenerator({ llmExecutor });

  const output = await generator.run({
    taskId: "task-1",
    stageId: "implementation_plan",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: resolveRequirementArtifactPath("/tmp/workspace"),
      architecture_document: resolveArchitectureArtifactPath("/tmp/workspace"),
      module_design_documents: JSON.stringify([
        resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow"),
        resolveModuleDesignArtifactPath("/tmp/workspace", "Data"),
      ]),
    },
  });

  assert.deepEqual(output, {
    stageId: "implementation_plan",
    success: true,
    summary: "Work plan generated.",
    artifacts: {
      artifactKey: "work_plan",
      content: "# Work Plan\n\nGenerated plan content.\n",
    },
  });

  assert.equal(llmExecutor.lastRequest?.responseFormat, "text");
  assert.equal(llmExecutor.lastRequest?.metadata?.stage, "implementation_plan");
  assert.equal(
    normalizePromptContent(llmExecutor.lastRequest?.prompt.systemPrompt ?? "").includes("work plan"),
    true,
  );

  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    target: string;
    requirementDocument: string;
    architectureDocument: string;
    moduleDesignDocuments: string[];
    sharedCollaborationStandardPath: string;
    template: string;
  };
  assert.equal(payload.target, "work_plan_generate");
  assert.equal(payload.requirementDocument, resolveRequirementArtifactPath("/tmp/workspace"));
  assert.equal(payload.architectureDocument, resolveArchitectureArtifactPath("/tmp/workspace"));
  assert.deepEqual(payload.moduleDesignDocuments, [
    resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow"),
    resolveModuleDesignArtifactPath("/tmp/workspace", "Data"),
  ]);
  assert.equal(payload.sharedCollaborationStandardPath, "meta_layer/resources/COLLABORATION_STANDARD.md");
  assert.equal(payload.template.includes("# Code Generation Execution Plan Template"), true);
  assert.equal(
    normalizePromptContent(llmExecutor.lastRequest?.prompt.systemPrompt ?? "").includes("cite the provided shared collaboration standard document path exactly"),
    true,
  );
}

async function testImplementationPlanGeneratorSupportsUpdateExecutionUnit(workspaceRoot: string): Promise<void> {
  const llmExecutor = new MockLlmExecutor("# Work Plan\n\nUpdated plan content.\n");
  const generator = new ImplementationPlanGenerator({ llmExecutor });

  const output = await generator.run({
    taskId: "task-1-update",
    stageId: "implementation_plan",
    attempt: 1,
    workspaceRoot,
    params: {
      executionUnit: "work_plan_update",
    },
    inputArtifacts: {
      requirement_document: resolveRequirementArtifactPath("/tmp/workspace"),
      architecture_document: resolveArchitectureArtifactPath("/tmp/workspace"),
      module_design_documents: JSON.stringify([
        resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow"),
      ]),
    },
  });

  assert.equal(output.summary, "Work plan updated.");
  const payload = JSON.parse(normalizeUserPromptContent(llmExecutor.lastRequest?.prompt.userPrompt ?? {})) as {
    target: string;
    moduleDesignDocuments: string[];
  };
  assert.equal(payload.target, "work_plan_update");
  assert.deepEqual(payload.moduleDesignDocuments, [
    resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow"),
  ]);
}

async function testImplementationPlanGeneratorRequiresRequirementDocument(workspaceRoot: string): Promise<void> {
  const generator = new ImplementationPlanGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-2",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        architecture_document: resolveArchitectureArtifactPath("/tmp/workspace"),
        module_design_documents: JSON.stringify([resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow")]),
      },
    }),
    /Missing required input artifact "requirement_document"\./,
  );
}

async function testImplementationPlanGeneratorRequiresArchitectureDocument(workspaceRoot: string): Promise<void> {
  const generator = new ImplementationPlanGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-3",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: resolveRequirementArtifactPath("/tmp/workspace"),
        module_design_documents: JSON.stringify([resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow")]),
      },
    }),
    /Missing required input artifact "architecture_document"\./,
  );
}

async function testImplementationPlanGeneratorRequiresModuleDesignDocuments(workspaceRoot: string): Promise<void> {
  const generator = new ImplementationPlanGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-4",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: resolveRequirementArtifactPath("/tmp/workspace"),
        architecture_document: resolveArchitectureArtifactPath("/tmp/workspace"),
      },
    }),
    /Missing required input artifact "module_design_documents"\./,
  );
}

async function testImplementationPlanGeneratorRejectsInvalidModuleDesignDocumentsJson(workspaceRoot: string): Promise<void> {
  const generator = new ImplementationPlanGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-5",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: resolveRequirementArtifactPath("/tmp/workspace"),
        architecture_document: resolveArchitectureArtifactPath("/tmp/workspace"),
        module_design_documents: "{invalid-json",
      },
    }),
    /Input artifact "module_design_documents" must be valid JSON\./,
  );
}

async function testImplementationPlanGeneratorRejectsInvalidModuleDesignDocumentsShape(workspaceRoot: string): Promise<void> {
  const generator = new ImplementationPlanGenerator({ llmExecutor: new MockLlmExecutor("unused") });

  await assert.rejects(
    generator.run({
      taskId: "task-6",
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: resolveRequirementArtifactPath("/tmp/workspace"),
        architecture_document: resolveArchitectureArtifactPath("/tmp/workspace"),
        module_design_documents: JSON.stringify({ path: resolveModuleDesignArtifactPath("/tmp/workspace", "Workflow") }),
      },
    }),
    /Input artifact "module_design_documents" must contain a non-empty string array\./,
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
