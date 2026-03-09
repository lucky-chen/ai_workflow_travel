import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import {
  CLIService,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
  ResourceWorkspaceInitializer,
} from "../../src/interface/cli/cli.js";
import { HistoryStoreService } from "../../src/data/history-store/history-store.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { TraceService } from "../../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import type {
  IContractChecker,
  ImplementationStageArtifacts,
  IPipeline,
  LaunchTaskRequest,
  StageOutput,
  StageRunContext,
} from "../../src/shared/contracts/pipeline.js";
import { ArchitectureStageRunner } from "../../src/workflow/stage-runners/architecture-stage-runner.js";
import { ImplementationPlanStageRunner } from "../../src/workflow/stage-runners/implementation-plan-stage-runner.js";
import type { IImplementationGitCommitter } from "../../src/workflow/stage-runners/implementation-git-committer.js";
import { ImplementationStageRunner } from "../../src/workflow/stage-runners/implementation-stage-runner.js";
import { ModuleStageRunner } from "../../src/workflow/stage-runners/module-stage-runner.js";
import { RequirementStageRunner } from "../../src/workflow/stage-runners/requirement-stage-runner.js";
import {
  resolveArchitectureArtifactPath,
  resolveImplementationPlanArtifactPath,
  resolveModuleDesignArtifactPath,
  resolveRequirementArtifactPath,
} from "../../src/workflow/stage-runners/stage-artifact-paths.js";
import { ValidationStageRunner } from "../../src/workflow/stage-runners/validation-stage-runner.js";
import type { ShellResult } from "../../src/workflow/validation/shell-runner.js";
import { ShellRunner } from "../../src/workflow/validation/shell-runner.js";

export async function runHelloServiceBaselineTests(): Promise<void> {
  const storageRoot = await createTempDir("hello-service-artifacts-");
  const workspaceRoot = resolveHelloServiceWorkspaceRoot();
  const historyStore = new HistoryStoreService(
    path.join(workspaceRoot, ".trace-history-store"),
    (taskId) => (taskId === "hello-service-task" ? workspaceRoot : undefined),
  );
  const traceRecorder = new TraceService(historyStore);
  const artifactStore = new ArtifactStoreService(storageRoot, traceRecorder);

  try {
    await resetHelloServiceWorkspace(workspaceRoot);
    await testHelloServiceWorkspaceInit(workspaceRoot);
    await testHelloServiceWorkspaceBaseline(artifactStore, traceRecorder, workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function testHelloServiceWorkspaceInit(workspaceRoot: string): Promise<void> {
  const parser = new DefaultCLICommandParser();
  const mapper = new DefaultCLIRequestMapper();
  const initializer = new ResourceWorkspaceInitializer();
  const traceViewer: ConsoleTraceViewer = {
    renderStatus(): void {},
    renderTrace(): void {},
    renderResult(): void {},
  };
  const pipeline: IPipeline = {
    async launchTask(): Promise<string> {
      throw new Error("launchTask should not be called for init.");
    },
  };

  const cli = new CLIService(parser, mapper, pipeline, traceViewer, initializer);
  const exitCode = await cli.run(["init", "--workspace", workspaceRoot]);

  assert.equal(exitCode, 0);
  assert.equal(
    (await readFile(path.join(workspaceRoot, "sdlc", "resources", "COLLABORATION_STANDARD.md"), "utf8"))
      .includes("# Collaboration Standard"),
    true,
  );
}

async function testHelloServiceWorkspaceBaseline(
  artifactStore: ArtifactStoreService,
  traceRecorder: TraceService,
  workspaceRoot: string,
): Promise<void> {
  const changeGate = new InMemoryChangeGate();
  const requirementRunner = new RequirementStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    llmExecutor: new ApproveRequirementContractLlmExecutor(),
  });

  const requirementContent = createHelloServiceRequirementDocument();
  const requirementOutput = await requirementRunner.run({
    taskId: "hello-service-task",
    stageId: "requirement_interpretation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: requirementContent,
    },
  });

  assert.equal(
    await readFile(path.join(workspaceRoot, resolveRequirementArtifactPath(workspaceRoot)), "utf8"),
    requirementContent,
  );

  const requestMapper = new DefaultCLIRequestMapper();
  assert.deepEqual(
    await requestMapper.map({
      command: "generate",
      options: {
        stage: "architecture_design",
        workspace: workspaceRoot,
      },
    }),
    {
      startStageId: "architecture_design",
      workspaceRoot,
      inputArtifacts: {
        requirement_document: requirementContent,
      },
    },
  );

  const architectureContent = createHelloServiceArchitectureDocument();
  const architectureRunner = new ArchitectureStageRunner({
    llmExecutor: new FixedDocumentLlmExecutor(architectureContent),
    artifactStore,
    traceRecorder,
    changeGate,
  });
  const architectureOutput = await architectureRunner.run({
    taskId: "hello-service-task",
    stageId: "architecture_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: requirementOutput.artifacts.content,
    },
  });

  assert.equal(
    await readFile(path.join(workspaceRoot, resolveArchitectureArtifactPath(workspaceRoot)), "utf8"),
    architectureContent,
  );

  assert.deepEqual(
    await requestMapper.map({
      command: "generate",
      options: {
        stage: "module_design",
        workspace: workspaceRoot,
        "target-module": "Workflow",
      },
    }),
    {
      startStageId: "module_design",
      workspaceRoot,
      inputArtifacts: {
        architecture_document: architectureContent,
        module_descriptors: JSON.stringify({
          name: "Workflow",
          responsibilities: [],
        }),
      },
      targetModule: "Workflow",
    },
  );

  const moduleDesignContent = createHelloServiceModuleDesignDocument();
  const moduleRunner = new ModuleStageRunner({
    llmExecutor: new FixedDocumentLlmExecutor(moduleDesignContent),
    artifactStore,
    traceRecorder,
    changeGate,
  });
  const moduleOutput = await moduleRunner.run({
    taskId: "hello-service-task",
    stageId: "module_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      architecture_document: architectureOutput.artifacts.content,
      module_descriptors: JSON.stringify({
        name: "Workflow",
        responsibilities: ["coordinate hello-service generation flow"],
      }),
    },
  });

  const moduleDesignPath = resolveModuleDesignArtifactPath(workspaceRoot, "Workflow");
  assert.equal(
    await readFile(path.join(workspaceRoot, moduleDesignPath), "utf8"),
    moduleDesignContent,
  );

  const implementationPlanContent = createHelloServiceImplementationPlanDocument();
  const implementationPlanRunner = new ImplementationPlanStageRunner({
    llmExecutor: new FixedDocumentLlmExecutor(implementationPlanContent),
    artifactStore,
    traceRecorder,
    changeGate,
  });
  const implementationPlanOutput = await implementationPlanRunner.run({
    taskId: "hello-service-task",
    stageId: "implementation_plan",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: requirementOutput.artifacts.requirement_document,
      architecture_document: architectureOutput.artifacts.architecture_document,
      module_design_documents: JSON.stringify([moduleOutput.artifacts.module_design_document]),
    },
  });

  const implementationPlanPath = resolveImplementationPlanArtifactPath(workspaceRoot);
  assert.equal(
    await readFile(path.join(workspaceRoot, implementationPlanPath), "utf8"),
    implementationPlanContent,
  );

  const mappedImplementationPlanRequest = await requestMapper.map({
    command: "generate",
    options: {
      stage: "implementation_plan",
      workspace: workspaceRoot,
    },
  });
  assert.equal(mappedImplementationPlanRequest.startStageId, "implementation_plan");
  assert.equal(mappedImplementationPlanRequest.workspaceRoot, workspaceRoot);
  assert.equal(
    mappedImplementationPlanRequest.inputArtifacts.requirement_document,
    requirementContent,
  );
  assert.equal(
    mappedImplementationPlanRequest.inputArtifacts.architecture_document,
    architectureContent,
  );
  assert.equal(
    JSON.stringify(JSON.parse(mappedImplementationPlanRequest.inputArtifacts.module_design_documents)),
    JSON.stringify([moduleDesignContent]),
  );

  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  const implementationRunner = new ImplementationStageRunner({
    generator: new HelloServiceImplementationGenerator(),
    contractChecker: new PassingImplementationContractChecker(),
    artifactStore,
    traceRecorder,
    changeGate,
    gitCommitter: new NoopGitCommitter(),
  });

  const implementationOutput = await implementationRunner.run({
    taskId: "hello-service-task",
    stageId: "implementation_execution",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      implementation_workplan: implementationPlanOutput.artifacts.implementation_workplan,
      parsed_implementation_workplan: implementationPlanOutput.artifacts.parsed_implementation_workplan,
      current_step: implementationPlanOutput.artifacts.current_step,
      requirement_document: requirementOutput.artifacts.content,
      architecture_document: architectureOutput.artifacts.content,
      module_design_documents: JSON.stringify([moduleOutput.artifacts.module_design_document]),
    },
  });

  assert.equal(implementationOutput.artifacts.implementation_execution_completed, "true");
  assert.equal(
    await readFile(path.join(workspaceRoot, "src", "index.ts"), "utf8"),
    'export function hello(): string {\n  return "hello-service";\n}\n',
  );

  const validationRunner = new ValidationStageRunner({
    shellRunner: new MockShellRunner({
      passed: true,
      summary: `Shell command passed: cd "${workspaceRoot}" && npm test`,
      command: `cd "${workspaceRoot}" && npm test`,
      exit_code: 0,
      logs: "ok",
    }),
    artifactStore,
    traceRecorder,
    changeGate,
  });
  const validationOutput = await validationRunner.run({
    taskId: "hello-service-task",
    stageId: "validation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {},
  });

  assert.equal(validationOutput.artifacts.projectPath, workspaceRoot);
  assert.equal(validationOutput.artifacts.command, `cd "${workspaceRoot}" && npm test`);
  await access(path.join(workspaceRoot, "src", "index.ts"));
  await access(path.join(workspaceRoot, "sdlc", "trace"));

  const implementationPlanHistory = JSON.parse(
    await readFile(
      path.join(workspaceRoot, "sdlc", "trace", "hello-service-task.json"),
      "utf8",
    ),
  ) as Array<{ category: string }>;
  assert.deepEqual(
    new Set(implementationPlanHistory.map((entry) => entry.category)),
    new Set(["trace", "contract", "review", "artifact"]),
  );
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

function resolveHelloServiceWorkspaceRoot(): string {
  return path.resolve(process.cwd(), "..", "..", "..", "user_projects", "hello-service");
}

async function resetHelloServiceWorkspace(workspaceRoot: string): Promise<void> {
  await rm(path.join(workspaceRoot, ".trace-history-store"), { recursive: true, force: true });
  await rm(path.join(workspaceRoot, "sdlc"), { recursive: true, force: true });
  await rm(path.join(workspaceRoot, "src"), { recursive: true, force: true });
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

class FixedDocumentLlmExecutor implements ILlmExecutor {
  constructor(private readonly content: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      return {
        content: JSON.stringify({
          passed: true,
          summary: "Document passed contract checks.",
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

class HelloServiceImplementationGenerator {
  async run(_context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    return {
      stageId: "implementation_execution",
      success: true,
      summary: "Generated hello-service implementation baseline.",
      artifacts: {
        summary: "Generated hello-service implementation baseline.",
        changedFiles: [
          {
            path: "src/index.ts",
            operation: "create",
            content: 'export function hello(): string {\n  return "hello-service";\n}\n',
          },
        ],
      },
    };
  }
}

class PassingImplementationContractChecker implements IContractChecker {
  async check(): Promise<{ passed: boolean; summary: string; issues: [] }> {
    return {
      passed: true,
      summary: "Hello-service implementation contract passed.",
      issues: [],
    };
  }
}

class NoopGitCommitter implements IImplementationGitCommitter {
  async commit(): Promise<void> {}
}

class MockShellRunner extends ShellRunner {
  constructor(private readonly result: ShellResult) {
    super();
  }

  override async run(_command: string): Promise<ShellResult> {
    return this.result;
  }
}

function createHelloServiceRequirementDocument(): string {
  return [
    "# 1. Background",
    "hello-service is a minimal service used to verify the SDLC baseline flow.",
    "",
    "# 2. User Scenarios",
    "Users need one simple endpoint-level service example.",
    "",
    "# 3. Product Goals",
    "- generate one minimal service implementation",
    "",
    "# 4. Core Problems and Product Abilities",
    "- provide one stable hello-service baseline for verification",
    "",
    "# 5. User Workflow",
    "- initialize workspace",
    "- generate design artifacts",
    "- generate code",
    "- validate workspace",
    "",
    "# 6. Inputs and Outputs",
    "- input: hello-service requirement",
    "- output: docs and src baseline",
    "",
    "# 7 Scope and Non-Goals",
    "- no production deployment in this verification step",
    "",
    "# 8. Success Criteria",
    "- documents and code are generated into the expected workspace layout",
    "",
    "# 9. Risks",
    "- baseline verification may expose path mismatches",
    "",
    "# 10. Constraints",
    "- keep the service intentionally minimal",
  ].join("\n");
}

function createHelloServiceArchitectureDocument(): string {
  return [
    "# 1. Purpose",
    "Define the hello-service architecture baseline.",
    "",
    "# 2. Scope",
    "One minimal service for SDLC verification.",
    "",
    "# 3. Design Drivers",
    "## 3.1 baseline verification",
    "Ensure the generated artifacts land in the expected workspace layout.",
    "",
    "# 4. Architecture Design",
    "## 4.1 Architecture Style",
    "Simple modular service.",
    "## 4.2 Layers or Partitions",
    "- Interface Layer",
    "- Service Layer",
    "- Validation Layer",
  ].join("\n");
}

function createHelloServiceModuleDesignDocument(): string {
  return [
    "# Workflow Design",
    "",
    "## 1. Goal",
    "Describe the hello-service workflow module baseline.",
    "",
    "## 2. Static Design",
    "",
    "### 2.1 Class Diagram",
    "```plantuml",
    "@startuml",
    "class HelloWorkflow",
    "@enduml",
    "```",
    "",
    "### 2.2 Core Class Responsibilities",
    "- coordinate hello-service flow",
    "",
    "## 4. Interface and Contract Design",
    "#### 4.1.2 Input Types",
    "- hello requirement",
    "#### 4.1.4 Output Types",
    "- hello service source files",
  ].join("\n");
}

function createHelloServiceImplementationPlanDocument(): string {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Purpose",
    "Generate the hello-service baseline implementation.",
    "",
    "## 1.1 Collaboration Rule",
    "- `meta_layer/resources/COLLABORATION_STANDARD.md`",
    "",
    "## 2. Workflow Delivery Order",
    "1. requirement_interpretation",
    "2. architecture_design",
    "3. module_design",
    "4. implementation_execution",
    "",
    "## 3. Execution Steps",
    "### Step 1. Deliver hello-service baseline",
    "- [ ] Step 1 is in progress",
    "- [ ] Architecture modules in scope",
    "  - [ ] `Workflow`",
    "- [ ] Batch 1: hello-service baseline",
    "  - [ ] create src/index.ts",
  ].join("\n");
}
