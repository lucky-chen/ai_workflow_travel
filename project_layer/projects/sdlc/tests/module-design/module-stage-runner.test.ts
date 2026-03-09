import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import { ModuleStageRunner } from "../../src/workflow/stage-runners/module-stage-runner.js";
import { resolveModuleDesignArtifactPath } from "../../src/workflow/stage-runners/stage-artifact-paths.js";

export async function runModuleStageRunnerTests(): Promise<void> {
  const workspaceRoot = await createTempDir("module-workspace-");

  try {
    await testModuleStageRunnerPersistsAcceptedDocument(workspaceRoot);
    await testModuleStageRunnerRejectStopsPersistence(workspaceRoot);
    await testModuleStageRunnerContractFailure(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testModuleStageRunnerPersistsAcceptedDocument(workspaceRoot: string): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const changeGate = new InMemoryChangeGate();
  const content = createModuleDesignDocument();
  const runner = new ModuleStageRunner({
    llmExecutor: new ModuleStageRunnerLlmExecutor(content),
    traceRecorder,
    changeGate,
  });

  const output = await runner.run({
    taskId: "task-1",
    stageId: "module_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      architecture_document: "# Technical Architecture\n\nArchitecture content.\n",
      module_descriptors: JSON.stringify({
        name: "Workflow",
        responsibilities: ["orchestrate stage execution", "coordinate stage handoff"],
      }),
    },
  });

  assert.equal(output.artifacts.module_design_document, resolveModuleDesignArtifactPath(workspaceRoot, "Workflow"));
  assert.equal(
    await readFile(path.join(workspaceRoot, resolveModuleDesignArtifactPath(workspaceRoot, "Workflow")), "utf8"),
    content,
  );
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "generation_started",
    "generation_finished",
    "contract_checked",
    "gate_reviewed",
    "artifact_persisted",
  ]);
}

async function testModuleStageRunnerRejectStopsPersistence(workspaceRoot: string): Promise<void> {
  await rm(path.join(workspaceRoot, resolveModuleDesignArtifactPath(workspaceRoot, "Workflow")), { force: true });
  const runner = new ModuleStageRunner({
    llmExecutor: new ModuleStageRunnerLlmExecutor(createModuleDesignDocument()),
    changeGate: new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Rejected in review.",
      },
    }),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-2",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        architecture_document: "# Technical Architecture\n\nArchitecture content.\n",
        module_descriptors: JSON.stringify({
          name: "Workflow",
          responsibilities: ["orchestrate stage execution"],
        }),
      },
    }),
    /Change review ended with action "reject"\./,
  );

  await assert.rejects(access(path.join(workspaceRoot, resolveModuleDesignArtifactPath(workspaceRoot, "Workflow"))));
}

async function testModuleStageRunnerContractFailure(
  workspaceRoot: string,
): Promise<void> {
  await rm(path.join(workspaceRoot, resolveModuleDesignArtifactPath(workspaceRoot, "Workflow")), { force: true });
  const runner = new ModuleStageRunner({
    llmExecutor: new ModuleStageRunnerLlmExecutor("# Workflow Design\n\nBroken output"),
    changeGate: new InMemoryChangeGate(),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-3",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        architecture_document: "# Technical Architecture\n\nArchitecture content.\n",
        module_descriptors: JSON.stringify({
          name: "Workflow",
          responsibilities: ["orchestrate stage execution"],
        }),
      },
    }),
    /Module design contract failed:/,
  );
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class ModuleStageRunnerLlmExecutor implements ILlmExecutor {
  constructor(private readonly content: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      const passed = this.content.includes("#### 4.1.2 Input Types")
        && this.content.includes("#### 4.1.4 Output Types");
      return {
        content: JSON.stringify({
          passed,
          summary: passed
            ? "Module design document passed contract checks."
            : "Module design document failed contract checks.",
          issues: passed ? [] : [
            {
              checkItem: "section_contract_alignment",
              message: "Missing required module design sections.",
              severity: "high",
            },
          ],
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

function createModuleDesignDocument(): string {
  return [
    "# Workflow Design",
    "",
    "## 1. Goal",
    "",
    "### 1.1 Purpose",
    "Define the workflow module boundary and stable orchestration APIs.",
    "",
    "### 1.2 Involved Modules",
    "This module design directly involves:",
    "",
    "- `Workflow/Pipeline`",
    "",
    "This module design collaborates with:",
    "",
    "- `Execution/RequirementGenerator`",
    "- `Contract/RequirementContract`",
    "",
    "### 1.3 Core Functions",
    "- stage orchestration",
    "- upstream artifact handoff",
    "",
    "## 2. Static Design",
    "",
    "### 2.1 Class Diagram",
    "```plantuml",
    "@startuml",
    "class WorkflowCoordinator",
    "@enduml",
    "```",
    "",
    "### 2.2 Core Class Responsibilities",
    "Role:",
    "",
    "- orchestrate workflow execution.",
    "",
    "Responsibilities:",
    "",
    "- coordinate stage transitions.",
    "- prepare stage runtime context.",
    "- hand off accepted artifacts downstream.",
    "",
    "## 3. Runtime Behavior",
    "",
    "### 3.1 Main Sequence Diagram",
    "```plantuml",
    "@startuml",
    "actor User",
    "User -> WorkflowCoordinator: run()",
    "@enduml",
    "```",
    "",
    "## 4. Interface Contract",
    "",
    "### 4.1 Generate Module Design",
    "",
    "#### 4.1.1 Purpose",
    "Generate the module design document for a single module descriptor.",
    "",
    "#### 4.1.2 Input Types",
    "```ts",
    "interface ModuleDesignInput {",
    "  architectureDocument: string",
    "  moduleDescriptor: ModuleDescriptor",
    "}",
    "```",
    "",
    "#### 4.1.3 Processing",
    "- load the architecture document",
    "- combine it with the target module descriptor",
    "- generate markdown that matches the template",
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
    "- keep module boundaries explicit",
    "- avoid implementation-level detail",
  ].join("\n");
}
