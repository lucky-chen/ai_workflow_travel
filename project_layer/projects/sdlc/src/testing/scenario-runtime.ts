import type { ApplicationConfig } from "../Runtime/application.js";
import { InMemoryChangeGate } from "../SDK/QualityControl/Gate/change-gate.js";
import type { LlmExecutorServiceDependencies } from "../SDK/AgentRuntime/LlmExecutor/llm-executor.js";

export function createCliBaselineRuntimeOptions(): ApplicationConfig {
  const serviceName = process.env.SDLC_TEST_SERVICE_NAME?.trim() || "baseline-service";
  return {
    llmExecutor: createCliBaselineLlmExecutor(serviceName),
    changeGate: new InMemoryChangeGate(),
  };
}

export function createCliBaselineLlmExecutor(serviceName = process.env.SDLC_TEST_SERVICE_NAME?.trim() || "baseline-service"): LlmExecutorServiceDependencies {
  return {
    mode: "mock",
    mockExecute: createScenarioMockExecute({
      serviceName,
      requirementDocument: createScenarioRequirementDocument(serviceName),
      architectureDocument: createScenarioArchitectureDocument(serviceName),
      itemDesignDocument: createScenarioItemDesignDocument(serviceName),
      workPlanDocument: createScenarioWorkPlanDocument(serviceName),
      contractFailureStages: readScenarioContractFailureStages(),
      contractIssueCategories: readScenarioContractIssueCategories(),
    }),
  };
}

interface ScriptedLlmExecutorDependencies {
  serviceName: string;
  requirementDocument: string;
  architectureDocument: string;
  itemDesignDocument: string;
  workPlanDocument: string;
  contractFailureStages: Set<string>;
  contractIssueCategories: string[];
}

function createScenarioMockExecute(
  dependencies: ScriptedLlmExecutorDependencies,
): NonNullable<LlmExecutorServiceDependencies["mockExecute"]> {
  return async (request) => {
    if (request.metadata?.checkType === "contract") {
      const executionUnitId = request.metadata?.executionUnit;
      const shouldFail = typeof executionUnitId === "string"
        && dependencies.contractFailureStages.has(executionUnitId);
      return {
        content: JSON.stringify(
          shouldFail
            ? buildFailedContractResult(dependencies, executionUnitId)
            : {
                passed: true,
                summary: "Document passed contract checks.",
                issues: [],
              },
        ),
        responseFormat: "json",
      };
    }

    switch (request.metadata?.executionUnit) {
      case "requirement_design_generate":
      case "requirement_design_update":
      case "requirement_design":
        return buildTextResult(request, dependencies.requirementDocument);
      case "architecture_design_generate":
      case "architecture_design_update":
      case "architecture_design":
        return buildTextResult(request, dependencies.architectureDocument);
      case "item_design_generate":
      case "item_design_update":
      case "item_design":
        return buildTextResult(request, dependencies.itemDesignDocument);
      case "work_plan_generate":
      case "work_plan_update":
      case "work_plan":
        return buildTextResult(request, dependencies.workPlanDocument);
      case "work_execute":
        return {
          content: JSON.stringify({
            summary: `Generated ${dependencies.serviceName} work execute baseline.`,
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
  executionUnitId: string,
): {
  passed: false;
  summary: string;
  issues: Array<{ checkItem: string; message: string; severity: "low" | "medium" | "high" }>;
} {
  const issues = dependencies.contractIssueCategories.map((category) => buildScenarioContractIssue(executionUnitId, category));
  return {
    passed: false,
    summary: `${executionUnitId} failed contract checks.`,
    issues,
  };
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

function createScenarioItemDesignDocument(serviceName: string): string {
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

function createScenarioWorkPlanDocument(serviceName: string): string {
  return [
    "version: 1",
    `plan_name: ${serviceName}_work_plan`,
    `target: deliver the ${serviceName} implementation baseline`,
    "sources:",
    "  requirement_doc: sdlc/docs/Requirement.md",
    "  architecture_doc: sdlc/docs/TechnicalArchitecture.md",
    "  breakdown_docs_dir: sdlc/docs/item_design",
    "  active_work_plan: sdlc/docs/work_plan.yaml",
    "  code_root: .",
    "principles:",
    "  - keep implementation minimal",
    "  - verify generated code with tests",
    `execution_scope: deliver the ${serviceName} baseline`,
    "status: pending",
    "current_focus:",
    "  stage_id: stage_1_delivery",
    "  batch_id: batch_1_1_source_file",
    "  task_id: task_1_1_1",
    "stages:",
    "  - stage_id: stage_1_delivery",
    "    name: baseline delivery",
    `    goal: deliver the ${serviceName} baseline`,
    "    status: pending",
    "    batches:",
    "      - batch_id: batch_1_1_source_file",
    "        name: create source file",
    "        goal: add the hello export file",
    "        status: pending",
    "        tasks:",
    "          - task_id: task_1_1_1",
    "            summary: add src/index.ts with hello export",
    "            status: pending",
    "            involved_files:",
    "              - src/index.ts",
    "    validation:",
    "      - src/index.ts exports the hello function",
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
  executionUnitId: string,
  category: string,
): { checkItem: string; message: string; severity: "low" | "medium" | "high" } {
  switch (category) {
    case "structure":
      return {
        checkItem: `${executionUnitId}-structure`,
        message: `${executionUnitId} is missing required structure sections.`,
        severity: "high",
      };
    case "scope":
      return {
        checkItem: `${executionUnitId}-scope`,
        message: `${executionUnitId} includes content outside the expected scope.`,
        severity: "medium",
      };
    case "alignment":
      return {
        checkItem: `${executionUnitId}-alignment`,
        message: `${executionUnitId} is not aligned with upstream design artifacts.`,
        severity: "high",
      };
    case "placeholder":
      return {
        checkItem: `${executionUnitId}-placeholder`,
        message: `${executionUnitId} still contains unresolved template placeholders.`,
        severity: "medium",
      };
    default:
      return {
        checkItem: `${executionUnitId}-${category}`,
        message: `${executionUnitId} failed scripted contract category "${category}".`,
        severity: "medium",
      };
  }
}
