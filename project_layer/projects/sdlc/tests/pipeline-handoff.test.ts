import assert from "node:assert/strict";
import { rm } from "node:fs/promises";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import { ArchitectureStageRunner } from "../src/workflow/stage-runners/architecture-stage-runner.js";
import { ImplementationPlanStageRunner } from "../src/workflow/stage-runners/implementation-plan-stage-runner.js";
import { ModuleStageRunner } from "../src/workflow/stage-runners/module-stage-runner.js";
import { RequirementStageRunner } from "../src/workflow/stage-runners/requirement-stage-runner.js";
import { ValidationStageRunner } from "../src/workflow/stage-runners/validation-stage-runner.js";
import { InMemoryChangeGate } from "../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../src/sdk/llm-executor/llm-executor.js";
import { PipelineService } from "../src/workflow/pipeline/pipeline.js";
import type { IStageRunner, StageOutput, StageRunContext } from "../src/shared/contracts/pipeline.js";
import type { ShellResult } from "../src/workflow/validation/shell-runner.js";
import { ShellRunner } from "../src/workflow/validation/shell-runner.js";
import {
  MockTextLlmExecutor,
  createArchitectureDocument,
  createRegistry,
  createRequirementDocument,
  createTempDir,
} from "./pipeline-test-helpers.js";

export async function runPipelineHandoffTests(workspaceRoot: string): Promise<void> {
  await testRequirementStageHandoffIntoImplementationExecution(workspaceRoot);
  await testValidationFinalStageMarksTaskCompleted(workspaceRoot);
  await testValidationRejectMarksTaskFailed(workspaceRoot);
}

async function testRequirementStageHandoffIntoImplementationExecution(workspaceRoot: string): Promise<void> {
  const storageRoot = await createTempDir("pipeline-requirement-");
  const artifactStore = new ArtifactStoreService(storageRoot);
  const traceRecorder = new InMemoryTraceRecorder();
  const implementationExecutionInvocationContexts: StageRunContext[] = [];
  const implementationExecutionStage: IStageRunner = {
    async run(context: StageRunContext): Promise<StageOutput> {
      implementationExecutionInvocationContexts.push(context);
      return {
        stageId: context.stageId,
        status: "completed",
        success: true,
        summary: "Implementation execution stage completed.",
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
          runner: new ImplementationPlanStageRunner({
            llmExecutor: new ImplementationPlanPipelineLlmExecutor(),
            artifactStore,
            traceRecorder,
          }),
          nextStageId: "implementation_execution",
        },
        {
          stageId: "implementation_execution",
          launchRequirements: ["implementation_workplan"],
          runner: implementationExecutionStage,
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

    assert.equal(implementationExecutionInvocationContexts.length, 1);
    const implementationExecutionContext = implementationExecutionInvocationContexts[0];
    assert.equal(
      implementationExecutionContext.inputArtifacts.implementation_workplan,
      "plans/implementation/ImplementationWorkPlan.md",
    );
    const implementationPlanOutput = await artifactStore.getArtifact({
      taskId,
      stageId: "implementation_plan",
      filePath: "plans/implementation/ImplementationWorkPlan.md",
    });
    assert.equal(implementationPlanOutput, createImplementationPlanDocument());
    const moduleDesignDocuments = JSON.parse(
      (
        await artifactStore.getArtifact({
          taskId,
          stageId: "module_design",
          filePath: "docs/module_design/Data.md",
        })
      ).length > 0
        ? JSON.stringify([
          "docs/module_design/Interface Layer.md",
          "docs/module_design/Workflow.md",
          "docs/module_design/Execution.md",
          "docs/module_design/Contract.md",
          "docs/module_design/Quality Gate.md",
          "docs/module_design/Data.md",
        ])
        : "[]",
    ) as string[];
    assert.deepEqual(moduleDesignDocuments, [
      "docs/module_design/Interface Layer.md",
      "docs/module_design/Workflow.md",
      "docs/module_design/Execution.md",
      "docs/module_design/Contract.md",
      "docs/module_design/Quality Gate.md",
      "docs/module_design/Data.md",
    ]);
    assert.deepEqual(implementationExecutionContext, {
      taskId,
      stageId: "implementation_execution",
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
        implementation_workplan: "plans/implementation/ImplementationWorkPlan.md",
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

class ImplementationPlanPipelineLlmExecutor implements ILlmExecutor {
  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      return {
        content: JSON.stringify({
          passed: true,
          summary: "Implementation workplan passed contract checks.",
          issues: [],
        }),
        responseFormat: "json",
      };
    }

    return {
      content: createImplementationPlanDocument(),
      responseFormat: "text",
      metadata: {
        ...(request.metadata ?? {}),
      },
    };
  }
}

async function testValidationFinalStageMarksTaskCompleted(workspaceRoot: string): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const pipeline = new PipelineService({
    traceRecorder,
    registry: createRegistry(
      {
        stageId: "implementation_execution",
        launchRequirements: ["project_path"],
        runner: {
          async run(context: StageRunContext): Promise<StageOutput> {
            return {
              stageId: context.stageId,
              status: "completed",
              success: true,
              summary: "Implementation execution stage completed.",
              artifacts: {
                project_path: context.inputArtifacts.project_path,
              },
            };
          },
        },
        nextStageId: "validation",
      },
      {
        stageId: "validation",
        launchRequirements: ["project_path"],
        runner: new ValidationStageRunner({
          traceRecorder,
          shellRunner: new MockValidationShellRunner({
            passed: true,
            summary: 'Shell command passed: cd "/tmp/final-project" && npm test',
            command: 'cd "/tmp/final-project" && npm test',
            exit_code: 0,
          }),
        }),
        nextStageId: null,
      },
    ),
  });

  const taskId = await pipeline.launchTask({
    startStageId: "implementation_execution",
    workspaceRoot,
    inputArtifacts: {
      project_path: "/tmp/final-project",
    },
  });

  assert.equal(pipeline.getTaskStatus(taskId), "completed");
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "task_started",
    "stage_started",
    "validation_finished",
    "task_finished",
  ]);
}

async function testValidationRejectMarksTaskFailed(workspaceRoot: string): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const pipeline = new PipelineService({
    traceRecorder,
    registry: createRegistry(
      {
        stageId: "implementation_execution",
        launchRequirements: ["project_path"],
        runner: {
          async run(context: StageRunContext): Promise<StageOutput> {
            return {
              stageId: context.stageId,
              status: "completed",
              success: true,
              summary: "Implementation execution stage completed.",
              artifacts: {
                project_path: context.inputArtifacts.project_path,
              },
            };
          },
        },
        nextStageId: "validation",
      },
      {
        stageId: "validation",
        launchRequirements: ["project_path"],
        runner: new ValidationStageRunner({
          traceRecorder,
          changeGate: new InMemoryChangeGate({
            decision: {
              action: "reject",
              summary: "Validation rejected by reviewer.",
            },
          }),
          shellRunner: new MockValidationShellRunner({
            passed: true,
            summary: 'Shell command passed: cd "/tmp/final-project" && npm test',
            command: 'cd "/tmp/final-project" && npm test',
            exit_code: 0,
          }),
        }),
        nextStageId: null,
      },
    ),
  });

  const taskId = await pipeline.launchTask({
    startStageId: "implementation_execution",
    workspaceRoot,
    inputArtifacts: {
      project_path: "/tmp/final-project",
    },
  });

  assert.equal(pipeline.getTaskStatus(taskId), "failed");
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "task_started",
    "stage_started",
    "validation_finished",
    "gate_reviewed",
    "stage_failed",
    "task_finished",
  ]);
}

class MockValidationShellRunner extends ShellRunner {
  constructor(private readonly result: ShellResult) {
    super();
  }

  override async run(_command: string): Promise<ShellResult> {
    return this.result;
  }
}

function createImplementationPlanDocument(): string {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Purpose",
    "Build project_layer from zero to a complete workflow.",
    "",
    "## 1.1 Collaboration Rule",
    "All implementation work under this plan must follow the shared collaboration standard:",
    "",
    "- `project_layer/docs/COLLABORATION_STANDARD.md`",
    "",
    "## 2. Workflow Delivery Order",
    "1. shared workflow backbone",
    "2. requirement_interpretation stage",
    "3. architecture_design stage",
    "4. module_design stage",
    "",
    "## 3. Execution Steps",
    "### Step 1. Deliver Shared Workflow Backbone",
    "- [x] Step 1 is partially completed",
    "- [x] Architecture modules in scope",
    "  - [x] `Workflow/Pipeline`",
    "- [x] Batch 1: interfaces and skeleton",
    "  - [x] shared contracts",
  ].join("\n");
}
