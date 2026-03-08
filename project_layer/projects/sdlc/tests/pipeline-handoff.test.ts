import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { ArchitectureStageRunner } from "../src/workflow/stage-runners/architecture-stage-runner.js";
import { ModuleStageRunner } from "../src/workflow/stage-runners/module-stage-runner.js";
import { RequirementStageRunner } from "../src/workflow/stage-runners/requirement-stage-runner.js";
import { InMemoryTraceRecorder } from "../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../src/sdk/llm-executor/llm-executor.js";
import { PipelineService } from "../src/workflow/pipeline/pipeline.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";
import {
  MockTextLlmExecutor,
  createArchitectureDocument,
  createRegistry,
  createRequirementDocument,
  createTempDir,
} from "./pipeline-test-helpers.js";

export async function runPipelineHandoffTests(workspaceRoot: string): Promise<void> {
  await testRequirementStageHandoffIntoImplementationPlan(workspaceRoot);
}

async function testRequirementStageHandoffIntoImplementationPlan(workspaceRoot: string): Promise<void> {
  const storageRoot = await createTempDir("pipeline-requirement-");
  const artifactStore = new ArtifactStoreService(storageRoot);
  const traceRecorder = new InMemoryTraceRecorder();
  const implementationPlanInvocationContexts: StageRunContext[] = [];
  const implementationPlanStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      implementationPlanInvocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Implementation plan stage completed.",
        artifacts: {},
      };
    },
  };

  try {
    const pipeline = new PipelineService({
      traceRecorder,
      registry: createRegistry(
        {
          stageId: "requirement_interpretation",
          launchRequirements: ["requirement_document"],
          runner: new RequirementStageRunner({
            artifactStore,
            traceRecorder,
            llmExecutor: new ApproveRequirementContractLlmExecutor(),
          }),
          nextStageId: "architecture_design",
        },
        {
          stageId: "architecture_design",
          launchRequirements: ["requirement_document"],
          runner: new ArchitectureStageRunner({
            llmExecutor: new ArchitecturePipelineLlmExecutor(createArchitectureDocument()),
            artifactStore,
            traceRecorder,
          }),
          nextStageId: "module_design",
        },
        {
          stageId: "module_design",
          launchRequirements: ["architecture_document", "module_descriptors"],
          runner: new ModuleStageRunner({
            llmExecutor: new ModulePipelineLlmExecutor(),
            artifactStore,
            traceRecorder,
          }),
          nextStageId: "implementation_plan",
        },
        {
          stageId: "implementation_plan",
          launchRequirements: ["requirement_document", "architecture_document", "module_design_documents"],
          runner: implementationPlanStage,
          nextStageId: null,
        },
      ),
    });

    const taskId = await pipeline.launchTask({
      startStageId: "requirement_interpretation",
      workspaceRoot,
      inputArtifacts: {
        requirement_document: createRequirementDocument(),
      },
    });

    assert.equal(implementationPlanInvocationContexts.length, 1);
    const implementationPlanContext = implementationPlanInvocationContexts[0];
    const moduleDesignDocuments = JSON.parse(
      implementationPlanContext.inputArtifacts.module_design_documents,
    ) as string[];
    assert.deepEqual(moduleDesignDocuments, [
      "docs/module_design/Interface Layer.md",
      "docs/module_design/Workflow.md",
      "docs/module_design/Execution.md",
      "docs/module_design/Contract.md",
      "docs/module_design/Quality Gate.md",
      "docs/module_design/Data.md",
    ]);
    assert.deepEqual(implementationPlanContext, {
      taskId,
      stageId: "implementation_plan",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: "docs/requirements/Requirement.md",
        architecture_document: "docs/architecture/TechnicalArchitecture.md",
        module_design_documents: JSON.stringify([
          "docs/module_design/Interface Layer.md",
          "docs/module_design/Workflow.md",
          "docs/module_design/Execution.md",
          "docs/module_design/Contract.md",
          "docs/module_design/Quality Gate.md",
          "docs/module_design/Data.md",
        ]),
      },
      params: undefined,
    });
    assert.equal(
      await artifactStore.getArtifact({
        taskId,
        stageId: "architecture_design",
        filePath: "docs/architecture/TechnicalArchitecture.md",
      }),
      createArchitectureDocument(),
    );
    assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
      "task_started",
      "stage_started",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "stage_started",
      "generation_started",
      "generation_finished",
      "contract_checked",
      "gate_reviewed",
      "artifact_persisted",
      "task_finished",
    ]);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

class ApproveRequirementContractLlmExecutor implements ILlmExecutor {
  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: JSON.stringify({
        passed: true,
        summary: "Requirement document passed contract checks.",
        issues: [],
      }),
      responseFormat: "json",
    };
  }
}

class ArchitecturePipelineLlmExecutor implements ILlmExecutor {
  constructor(private readonly content: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      return {
        content: JSON.stringify({
          passed: true,
          summary: "Architecture design document passed contract checks.",
          issues: [],
        }),
        responseFormat: "json",
      };
    }

    return {
      content: this.content,
      responseFormat: "text",
      metadata: {
        ...(request.metadata ?? {}),
      },
    };
  }
}

class ModulePipelineLlmExecutor implements ILlmExecutor {
  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      return {
        content: JSON.stringify({
          passed: true,
          summary: "Module design document passed contract checks.",
          issues: [],
        }),
        responseFormat: "json",
      };
    }

    const payload = JSON.parse(request.prompt.userPrompt) as {
      moduleDescriptor: { name: string; responsibilities: string[] };
    };
    const moduleName = payload.moduleDescriptor.name;

    return {
      content: [
        `# ${moduleName} Design`,
        "",
        "## 1. Goal",
        "",
        "### 1.1 Purpose",
        `Define ${moduleName} from the accepted architecture.`,
        "",
        "### 1.2 Involved Modules",
        "This module design directly involves:",
        "",
        `- \`${moduleName}\``,
        "",
        "This module design collaborates with:",
        "",
        "- `Workflow/Pipeline`",
        "",
        "### 1.3 Core Functions",
        "- stable responsibilities from architecture",
        "",
        "## 2. Static Design",
        "",
        "### 2.1 Class Diagram",
        "```plantuml",
        "@startuml",
        `class ${moduleName.replace(/\s+/g, "")}Coordinator`,
        "@enduml",
        "```",
        "",
        "### 2.2 Core Class Responsibilities",
        "Role:",
        "",
        "- define module responsibility.",
        "",
        "Responsibilities:",
        "",
        "- preserve architecture boundaries.",
        "",
        "## 3. Runtime Behavior",
        "",
        "### 3.1 Main Sequence Diagram",
        "```plantuml",
        "@startuml",
        "actor Workflow",
        `Workflow -> ${moduleName.replace(/\s+/g, "")}Coordinator: design()`,
        "@enduml",
        "```",
        "",
        "## 4. Interface Contract",
        "",
        "### 4.1 Generate Module Design",
        "",
        "#### 4.1.1 Purpose",
        "Generate module design output.",
        "",
        "#### 4.1.2 Input Types",
        "```ts",
        "interface ModuleDesignInput {",
        "  architectureDocument: string",
        "  moduleDescriptor: ModuleDescriptor",
        "}",
        "```",
        "",
        "#### 4.1.4 Output Types",
        "```ts",
        "interface ModuleDesignOutput {",
        "  artifactKey: \"module_design_document\"",
        "  moduleName: string",
        "  content: string",
        "}",
        "```",
        "",
        "## 4.2 Constraints",
        "- stay architecture-aligned",
      ].join("\n"),
      responseFormat: "text",
      metadata: {
        ...(request.metadata ?? {}),
      },
    };
  }
}
