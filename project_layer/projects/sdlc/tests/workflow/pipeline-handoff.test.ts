import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";

import { ArtifactStoreService } from "../../src/data/artifact-store.js";
import { ArchitectureStageRunner } from "../../src/workflow/stage-runners/architecture-stage-runner.js";
import { ImplementationPlanStageRunner } from "../../src/workflow/stage-runners/implementation-plan-stage-runner.js";
import { ModuleStageRunner } from "../../src/workflow/stage-runners/module-stage-runner.js";
import { RequirementStageRunner } from "../../src/workflow/stage-runners/requirement-stage-runner.js";
import { ValidationStageRunner } from "../../src/workflow/stage-runners/validation-stage-runner.js";
import { OverallDesignContractRunner } from "../../src/workflow/stage-runners/overall-design-contract-runner.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace-recorder.js";
import {
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";
import { PipelineService } from "../../src/workflow/pipeline/pipeline.js";
import { createModuleDesignFanoutContinuation } from "../../src/workflow/pipeline/module-design-fanout.js";
import type { IStageRunner, StageDefinition, StageOutput, StageRunContext } from "../../src/shared/contracts/pipeline.js";
import type { ShellResult } from "../../src/workflow/shell-runner.js";
import { ShellRunner } from "../../src/workflow/shell-runner.js";
import {
  resolveArchitectureArtifactPath,
  resolveImplementationPlanArtifactPath,
  resolveModuleDesignArtifactPath,
  resolveRequirementArtifactPath,
} from "../../src/workflow/stage-runners/stage-artifact-paths.js";
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
    const moduleStageDefinition: StageDefinition = {
      stageId: "module_design",
      launchRequirements: ["architecture_document", "module_descriptors"],
      runner: new ModuleStageRunner({
        llmExecutor: new ModulePipelineLlmExecutor(),
        traceRecorder,
      }),
      nextStageId: "overall_design_contract",
    };

    const pipeline = new PipelineService({
      traceRecorder,
      registry: createRegistry(
        {
          stageId: "requirement_interpretation",
          launchRequirements: ["requirement_document"],
          runner: new RequirementStageRunner({
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
            traceRecorder,
          }),
          nextStageId: "module_design",
          continuation: createModuleDesignFanoutContinuation(moduleStageDefinition),
        },
        moduleStageDefinition,
        {
          stageId: "overall_design_contract",
          launchRequirements: ["requirement_document", "architecture_document", "module_design_documents"],
          runner: new OverallDesignContractRunner({
            traceRecorder,
          }),
          nextStageId: "implementation_plan",
        },
        {
          stageId: "implementation_plan",
          launchRequirements: ["requirement_document", "architecture_document", "module_design_documents"],
          runner: new ImplementationPlanStageRunner({
            llmExecutor: new ImplementationPlanPipelineLlmExecutor(),
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
      resolveImplementationPlanArtifactPath(workspaceRoot),
    );
    assert.equal(
      implementationExecutionContext.inputArtifacts.work_plan,
      resolveImplementationPlanArtifactPath(workspaceRoot),
    );
    assert.equal(typeof implementationExecutionContext.inputArtifacts.parsed_implementation_workplan, "string");
    assert.equal(
      implementationExecutionContext.inputArtifacts.current_step,
      JSON.stringify({ stepId: "step-1", batchId: "batch-1" }),
    );
    const implementationPlanOutput = await readFile(
      `${workspaceRoot}/${resolveImplementationPlanArtifactPath(workspaceRoot)}`,
      "utf8",
    );
    assert.equal(implementationPlanOutput, createImplementationPlanDocument());
    const moduleDesignDocuments = JSON.parse(
      (
        await readFile(
          `${workspaceRoot}/${resolveModuleDesignArtifactPath(workspaceRoot, "Data")}`,
          "utf8",
        )
      ).length > 0
        ? JSON.stringify([
          resolveModuleDesignArtifactPath(workspaceRoot, "Workflow"),
          resolveModuleDesignArtifactPath(workspaceRoot, "Data"),
        ])
        : "[]",
    ) as string[];
    assert.deepEqual(moduleDesignDocuments, [
      resolveModuleDesignArtifactPath(workspaceRoot, "Workflow"),
      resolveModuleDesignArtifactPath(workspaceRoot, "Data"),
    ]);
    assert.match(implementationExecutionContext.runId ?? "", /^\d+$/);
    assert.deepEqual(implementationExecutionContext, {
      taskId,
      runId: implementationExecutionContext.runId,
      stageId: "implementation_execution",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: resolveRequirementArtifactPath(workspaceRoot),
        architecture_design: resolveArchitectureArtifactPath(workspaceRoot),
        architecture_document: resolveArchitectureArtifactPath(workspaceRoot),
        overall_design_contract_result: "artifacts/design/overall_design_contract_result.json",
        contract_result: JSON.stringify({
          passed: true,
          summary: "Overall design contract passed.",
          issues: [],
        }),
        item_design_document: resolveModuleDesignArtifactPath(workspaceRoot, "Data"),
        item_design_documents: JSON.stringify([
          resolveModuleDesignArtifactPath(workspaceRoot, "Workflow"),
          resolveModuleDesignArtifactPath(workspaceRoot, "Data"),
        ]),
        module_design_documents: JSON.stringify([
          resolveModuleDesignArtifactPath(workspaceRoot, "Workflow"),
          resolveModuleDesignArtifactPath(workspaceRoot, "Data"),
        ]),
        implementation_workplan: resolveImplementationPlanArtifactPath(workspaceRoot),
        work_plan: resolveImplementationPlanArtifactPath(workspaceRoot),
        parsed_implementation_workplan: JSON.stringify({
          steps: [
            {
              stepId: "step-1",
              title: "Shared Workflow Backbone",
              status: "in_progress",
              architectureModulesInScope: ["Workflow/Pipeline"],
              batches: [
                {
                  batchId: "batch-1",
                  title: "interfaces and skeleton",
                  status: "completed",
                  tasks: ["shared contracts"],
                },
              ],
            },
          ],
        }),
        current_step: JSON.stringify({
          stepId: "step-1",
          batchId: "batch-1",
        }),
      },
      params: undefined,
    });
    assert.equal(
      await readFile(
        `${workspaceRoot}/${resolveArchitectureArtifactPath(workspaceRoot)}`,
        "utf8",
      ),
      createArchitectureDocument(),
    );
    assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
      "task_started",
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

    const payload = JSON.parse(normalizeUserPromptContent(request.prompt.userPrompt)) as {
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
        launchRequirements: [],
        runner: {
          async run(context: StageRunContext): Promise<StageOutput> {
            return {
              stageId: context.stageId,
              status: "completed",
              success: true,
              summary: "Implementation execution stage completed.",
              artifacts: {},
            };
          },
        },
        nextStageId: "validation",
      },
      {
        stageId: "validation",
        launchRequirements: [],
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
    inputArtifacts: {},
  });

  assert.equal(pipeline.getTaskStatus(taskId), "completed");
  const eventTypes = traceRecorder.getEvents().map((entry) => entry.event.eventType);
  assert.deepEqual(eventTypes, [
    "task_started",
    "stage_started",
    "validation_finished",
    "task_finished",
  ]);
  assert.equal(eventTypes.includes("contract_checked"), false);
}

async function testValidationRejectMarksTaskFailed(workspaceRoot: string): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const pipeline = new PipelineService({
    traceRecorder,
    registry: createRegistry(
      {
        stageId: "implementation_execution",
        launchRequirements: [],
        runner: {
          async run(context: StageRunContext): Promise<StageOutput> {
            return {
              stageId: context.stageId,
              status: "completed",
              success: true,
              summary: "Implementation execution stage completed.",
              artifacts: {},
            };
          },
        },
        nextStageId: "validation",
      },
      {
        stageId: "validation",
        launchRequirements: [],
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
    inputArtifacts: {},
  });

  assert.equal(pipeline.getTaskStatus(taskId), "failed");
  const eventTypes = traceRecorder.getEvents().map((entry) => entry.event.eventType);
  assert.deepEqual(eventTypes, [
    "task_started",
    "stage_started",
    "validation_finished",
    "gate_reviewed",
    "stage_failed",
    "task_finished",
  ]);
  assert.equal(eventTypes.includes("contract_checked"), false);
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
    "- `meta_layer/resources/COLLABORATION_STANDARD.md`",
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
