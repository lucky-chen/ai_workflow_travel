import { ArtifactStoreService } from "../data/artifact-store/artifact-store.js";
import { HistoryStoreService } from "../data/history-store/history-store.js";
import { InMemoryChangeGate } from "../quality-gate/change-gate/change-gate.js";
import { TraceService } from "../quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import type {
  IContractChecker,
  ImplementationStageArtifacts,
  IPipeline,
  StageOutput,
  StageRunContext,
} from "../shared/contracts/pipeline.js";
import { ArchitectureStageRunner } from "../workflow/stage-runners/architecture-stage-runner.js";
import { ImplementationPlanStageRunner } from "../workflow/stage-runners/implementation-plan-stage-runner.js";
import type { IImplementationGitCommitter } from "../workflow/stage-runners/implementation-git-committer.js";
import { ImplementationStageRunner } from "../workflow/stage-runners/implementation-stage-runner.js";
import { ModuleStageRunner } from "../workflow/stage-runners/module-stage-runner.js";
import { RequirementStageRunner } from "../workflow/stage-runners/requirement-stage-runner.js";
import { ValidationStageRunner } from "../workflow/stage-runners/validation-stage-runner.js";
import type { ShellResult } from "../workflow/validation/shell-runner.js";
import { ShellRunner } from "../workflow/validation/shell-runner.js";

export function createCliBaselineTestRuntime(): { pipeline: IPipeline } {
  const taskId = process.env.SDLC_TEST_TASK_ID?.trim() || "baseline-task";
  const serviceName = process.env.SDLC_TEST_SERVICE_NAME?.trim() || "baseline-service";
  const historyStore = new HistoryStoreService(
    process.env.SDLC_HISTORY_ROOT,
    (candidateTaskId) => (candidateTaskId === taskId ? process.env.SDLC_WORKSPACE_ROOT : undefined),
  );
  const traceRecorder = new TraceService(historyStore);
  const artifactStore = new ArtifactStoreService(process.env.SDLC_ARTIFACT_ROOT, traceRecorder);
  const changeGate = new InMemoryChangeGate();

  const requirementRunner = new RequirementStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    llmExecutor: new PassingRequirementContractLlmExecutor(),
  });
  const architectureRunner = new ArchitectureStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    llmExecutor: new DeterministicDocumentLlmExecutor(createScenarioArchitectureDocument(serviceName)),
  });
  const moduleRunner = new ModuleStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    llmExecutor: new DeterministicDocumentLlmExecutor(createScenarioModuleDesignDocument(serviceName)),
  });
  const implementationPlanRunner = new ImplementationPlanStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    llmExecutor: new DeterministicDocumentLlmExecutor(createScenarioImplementationPlanDocument(serviceName)),
  });
  const implementationRunner = new ImplementationStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    generator: new CliBaselineImplementationGenerator(serviceName),
    contractChecker: new PassingCliBaselineImplementationContractChecker(serviceName),
    gitCommitter: new NoopGitCommitter(),
  });
  const validationRunner = new ValidationStageRunner({
    artifactStore,
    traceRecorder,
    changeGate,
    shellRunner: new MockShellRunner(),
  });

  return {
    pipeline: {
      async launchTask(request) {
        const baseContext = {
          taskId,
          attempt: 1,
          workspaceRoot: request.workspaceRoot,
          inputArtifacts: request.inputArtifacts,
        };

        switch (request.startStageId) {
          case "requirement_interpretation":
            await requirementRunner.run({ ...baseContext, stageId: "requirement_interpretation" });
            break;
          case "architecture_design":
            await architectureRunner.run({ ...baseContext, stageId: "architecture_design" });
            break;
          case "module_design":
            await moduleRunner.run({ ...baseContext, stageId: "module_design" });
            break;
          case "implementation_plan":
            await implementationPlanRunner.run({ ...baseContext, stageId: "implementation_plan" });
            break;
          case "implementation_execution":
            await implementationRunner.run({ ...baseContext, stageId: "implementation_execution" });
            break;
          case "validation":
            await validationRunner.run({ ...baseContext, stageId: "validation" });
            break;
          default:
            throw new Error(`Unsupported fixed workspace scenario stage: ${request.startStageId}`);
        }

        return taskId;
      },
    },
  };
}

class PassingRequirementContractLlmExecutor implements ILlmExecutor {
  async execute(): Promise<LlmExecutionResult> {
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

class DeterministicDocumentLlmExecutor implements ILlmExecutor {
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

class CliBaselineImplementationGenerator {
  constructor(private readonly serviceName: string) {}

  async run(_context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    return {
      stageId: "implementation_execution",
      success: true,
      summary: `Generated ${this.serviceName} implementation baseline.`,
      artifacts: {
        summary: `Generated ${this.serviceName} implementation baseline.`,
        changedFiles: [
          {
            path: "src/index.ts",
            operation: "create",
            content: `export function hello(): string {\n  return "${this.serviceName}";\n}\n`,
          },
        ],
      },
    };
  }
}

class PassingCliBaselineImplementationContractChecker implements IContractChecker {
  constructor(private readonly serviceName: string) {}

  async check(): Promise<{ passed: boolean; summary: string; issues: [] }> {
    return {
      passed: true,
      summary: `${this.serviceName} implementation contract passed.`,
      issues: [],
    };
  }
}

class NoopGitCommitter implements IImplementationGitCommitter {
  async commit(): Promise<void> {}
}

class MockShellRunner extends ShellRunner {
  override async run(command: string): Promise<ShellResult> {
    return {
      passed: true,
      summary: `Shell command passed: ${command}`,
      command,
      exit_code: 0,
      logs: "ok",
    };
  }
}

function createScenarioArchitectureDocument(serviceName: string): string {
  return [
    "# 1. System Overview",
    `${serviceName} uses a minimal function export as the service boundary.`,
    "",
    "# 2. Runtime Flow",
    `The service exposes one hello function returning a stable string for ${serviceName}.`,
    "",
    "# 3. Module Design",
    "- Workflow",
    "",
    "# 4. Data and State",
    "No persistent state is required.",
    "",
    "# 5. Validation Strategy",
    "Validate that the generated file exists and exports the expected function.",
  ].join("\n");
}

function createScenarioModuleDesignDocument(serviceName: string): string {
  return [
    "# 1. Module Overview",
    `Workflow coordinates the ${serviceName} generation baseline.`,
    "",
    "# 2. Responsibilities",
    "- define the hello function contract",
    "- keep implementation minimal",
    "",
    "# 3. Interfaces",
    "- export function hello(): string",
    "",
    "# 4. Dependencies",
    "- no external dependencies",
    "",
    "# 5. Risks and Constraints",
    "- keep the output intentionally minimal for verification",
  ].join("\n");
}

function createScenarioImplementationPlanDocument(serviceName: string): string {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Goal",
    `- deliver the ${serviceName} implementation baseline`,
    "",
    "## 2. Scope",
    "- Workflow",
    "",
    "### Step 1. Deliver Baseline Service",
    "- [ ] `Step 1 is not started`",
    "  - [ ] `Workflow`",
    "- [ ] Batch 1: Create source file",
    "  - [ ] add src/index.ts with hello export",
    "",
    "## 4. Implementation Execution State",
    "- [ ] batch-1",
  ].join("\n");
}
