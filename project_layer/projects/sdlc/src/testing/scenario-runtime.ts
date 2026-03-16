import type { CompositionRootOptions } from "../app/composition-root.js";
import { InMemoryChangeGate } from "../quality-gate/change-gate.js";
import type { LlmExecutorServiceDependencies } from "../sdk/llm-executor/llm-executor.js";
import type { IImplementationGitCommitter } from "../workflow/stage-runners/implementation-git-committer.js";
import { ShellRunner } from "../workflow/shell-runner.js";

export function createCliBaselineRuntimeOptions(): CompositionRootOptions {
  const serviceName = process.env.SDLC_TEST_SERVICE_NAME?.trim() || "baseline-service";
  return {
    artifactStorageRoot: process.env.SDLC_ARTIFACT_ROOT,
    llmExecutor: {
      mode: "mock",
      mockExecute: createScenarioMockExecute({
        serviceName,
        requirementDocument: createScenarioRequirementDocument(serviceName),
        architectureDocument: createScenarioArchitectureDocument(serviceName),
        moduleDesignDocument: createScenarioModuleDesignDocument(serviceName),
        implementationPlanDocument: createScenarioImplementationPlanDocument(serviceName),
        contractFailureStages: readScenarioContractFailureStages(),
        contractIssueCategories: readScenarioContractIssueCategories(),
      }),
    },
    shellRunner: new ShellRunner(),
    gitCommitter: new NoopGitCommitter(),
    changeGate: new InMemoryChangeGate(),
  };
}

interface ScriptedLlmExecutorDependencies {
  serviceName: string;
  requirementDocument: string;
  architectureDocument: string;
  moduleDesignDocument: string;
  implementationPlanDocument: string;
  contractFailureStages: Set<string>;
  contractIssueCategories: string[];
}

function createScenarioMockExecute(
  dependencies: ScriptedLlmExecutorDependencies,
): NonNullable<LlmExecutorServiceDependencies["mockExecute"]> {
  return async (request) => {
    if (request.metadata?.checkType === "contract") {
      const stageId = request.metadata?.stage;
      const shouldFail = typeof stageId === "string"
        && dependencies.contractFailureStages.has(stageId);
      return {
        content: JSON.stringify(
          shouldFail
            ? buildFailedContractResult(dependencies, stageId)
            : {
                passed: true,
                summary: "Document passed contract checks.",
                issues: [],
              },
        ),
        responseFormat: "json",
      };
    }

    switch (request.metadata?.stage) {
      case "requirement_interpretation":
        return buildTextResult(request, dependencies.requirementDocument);
      case "architecture_design":
        return buildTextResult(request, dependencies.architectureDocument);
      case "module_design":
        return buildTextResult(request, dependencies.moduleDesignDocument);
      case "implementation_plan":
        return buildTextResult(request, dependencies.implementationPlanDocument);
      case "implementation":
        return {
          content: JSON.stringify({
            summary: `Generated ${dependencies.serviceName} implementation baseline.`,
            changed_files: [
              {
                path: "src/index.ts",
                operation: "create",
                content: `export function hello(): string {\n  return "${dependencies.serviceName}";\n}\n`,
              },
            ],
          }),
          responseFormat: "json",
          metadata: {
            ...(request.metadata ?? {}),
          },
        };
      default:
        return {
          content: JSON.stringify({
            passed: true,
            summary: "Requirement document passed contract checks.",
            issues: [],
          }),
          responseFormat: request.responseFormat,
          metadata: {
            ...(request.metadata ?? {}),
          },
        };
    }
  };
}

function buildTextResult(
  request: Parameters<NonNullable<LlmExecutorServiceDependencies["mockExecute"]>>[0],
  content: string,
) {
  return {
    content,
    responseFormat: "text" as const,
    metadata: {
      ...(request.metadata ?? {}),
    },
  };
}

function buildFailedContractResult(
  dependencies: ScriptedLlmExecutorDependencies,
  stageId: string,
): {
  passed: false;
  summary: string;
  issues: Array<{ checkItem: string; message: string; severity: "low" | "medium" | "high" }>;
} {
  const issues = dependencies.contractIssueCategories.map((category) => buildScenarioContractIssue(stageId, category));
  return {
    passed: false,
    summary: `${stageId} failed contract checks.`,
    issues,
  };
}

class NoopGitCommitter implements IImplementationGitCommitter {
  async commit(): Promise<void> {}
}

function createScenarioRequirementDocument(serviceName: string): string {
  return [
    "# 1. Background",
    `- ${serviceName} needs a stable requirement document before downstream design starts.`,
    "- The generated document must stay product-facing and reviewable.",
    "",
    "# 2. User Scenarios",
    "## 2.1 Technical Founders",
    "Need a quick way to turn a rough request into a requirement baseline.",
    "",
    "# 3. Product Goals",
    `Deliver a reviewable requirement baseline for ${serviceName}.`,
    "- Reduce ambiguity before architecture design.",
    "",
    "# 4. Core Problems and Product Abilities",
    "## 4.1 Requirements are not directly actionable",
    "- problem: raw requests are ambiguous and unstable for downstream work.",
    "- ability: generate a structured requirement document that downstream stages can consume.",
  ].join("\n");
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

function readScenarioContractFailureStages(): Set<string> {
  const value = process.env.SDLC_TEST_CONTRACT_FAILURE_STAGES?.trim();
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function readScenarioContractIssueCategories(): string[] {
  const value = process.env.SDLC_TEST_CONTRACT_ISSUE_CATEGORIES?.trim();
  if (!value) {
    return ["structure"];
  }

  const categories = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return categories.length > 0 ? categories : ["structure"];
}

function buildScenarioContractIssue(
  stageId: string,
  category: string,
): { checkItem: string; message: string; severity: "low" | "medium" | "high" } {
  switch (category) {
    case "structure":
      return {
        checkItem: `${stageId}-structure`,
        message: `${stageId} is missing required structure sections.`,
        severity: "high",
      };
    case "scope":
      return {
        checkItem: `${stageId}-scope`,
        message: `${stageId} includes content outside the expected scope.`,
        severity: "medium",
      };
    case "alignment":
      return {
        checkItem: `${stageId}-alignment`,
        message: `${stageId} is not aligned with upstream design artifacts.`,
        severity: "high",
      };
    case "placeholder":
      return {
        checkItem: `${stageId}-placeholder`,
        message: `${stageId} still contains unresolved template placeholders.`,
        severity: "medium",
      };
    default:
      return {
        checkItem: `${stageId}-${category}`,
        message: `${stageId} failed scripted contract category "${category}".`,
        severity: "medium",
      };
  }
}
