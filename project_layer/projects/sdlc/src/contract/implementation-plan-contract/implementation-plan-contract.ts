import type {
  ContractCheckResult,
  ContractIssue,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import { normalizeUserPromptContent, type LlmExecutionRequest } from "../../sdk/llm-executor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../document-stage-contract.js";
import { DocumentStageContract } from "../document-stage-contract.js";
import type { ImplementationWorkPlan, ImplementationWorkPlanBatch, ImplementationWorkPlanStatus, ImplementationWorkPlanStep } from "../../shared/contracts/implementation-workplan.js";

interface ImplementationPlanArtifacts {
  artifactKey: "implementation_workplan";
  content: string;
}

export class ImplementationPlanContract extends DocumentStageContract {
  parseWorkPlan(content: string): ImplementationWorkPlan {
    const lines = content.split(/\r?\n/);
    const steps: ImplementationWorkPlanStep[] = [];
    let currentStep: ImplementationWorkPlanStep | undefined;
    let currentBatch: ImplementationWorkPlanBatch | undefined;

    for (const line of lines) {
      const stepHeadingMatch = line.match(/^### Step (\d+)\.\s+Deliver\s+(.+)$/);
      if (stepHeadingMatch) {
        currentStep = {
          stepId: `step-${stepHeadingMatch[1]}`,
          title: stepHeadingMatch[2].trim(),
          status: "not_started",
          architectureModulesInScope: [],
          batches: [],
        };
        steps.push(currentStep);
        currentBatch = undefined;
        continue;
      }

      if (!currentStep) {
        continue;
      }

      const stepStatusMatch = line.match(/^- \[( |x)\]\s*`?Step \d+ is (.+?)`?$/);
      if (stepStatusMatch) {
        currentStep.status = this.parseStatus(stepStatusMatch[1], stepStatusMatch[2]);
        continue;
      }

      const moduleMatch = line.match(/^  - \[( |x)\]\s*`?(.+?)`?$/);
      if (moduleMatch && !currentBatch) {
        currentStep.architectureModulesInScope.push(moduleMatch[2].trim());
        continue;
      }

      const batchMatch = line.match(/^- \[( |x)\]\s*Batch (\d+):\s*(.+)$/);
      if (batchMatch) {
        currentBatch = {
          batchId: `batch-${batchMatch[2]}`,
          title: batchMatch[3].trim(),
          status: batchMatch[1] === "x" ? "completed" : "not_started",
          tasks: [],
        };
        currentStep.batches.push(currentBatch);
        continue;
      }

      const taskMatch = line.match(/^  - \[( |x)\]\s*(.+)$/);
      if (taskMatch && currentBatch) {
        currentBatch.tasks.push(taskMatch[2].trim());
      }
    }

    if (steps.length === 0 || steps.some((step) => step.batches.length === 0)) {
      throw new Error("Implementation workplan markdown could not be parsed into a valid structured workplan.");
    }

    return { steps };
  }

  protected getContractResourcePath(): string {
    return "contract/CodeGenerationExecutionPlanTemplate.contract.json";
  }

  protected getStageId(): string {
    return "implementation_plan";
  }

  protected async buildCheckRequest(
    context: StageRunContext,
    output: StageOutput,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const implementationPlanOutput = output as StageOutput<ImplementationPlanArtifacts>;
    const generatedResult = implementationPlanOutput.artifacts.content.trim();
    const moduleDesignDocuments = this.parseModuleDesignDocuments(context.inputArtifacts.module_design_documents);

    return {
      prompt: {
        systemPrompt:
          "You check whether an implementation workplan satisfies the provided contract spec. " +
          "Return JSON with passed, summary, and issues only.",
        userPrompt: {
          target: "implementation_plan_contract_check",
          generatedResult,
          contractSpec: JSON.stringify(contractSpec),
          upstreamContext: JSON.stringify({
            requirement_document: context.inputArtifacts.requirement_document,
            architecture_document: context.inputArtifacts.architecture_document,
            module_design_documents: moduleDesignDocuments,
          }),
          requiredOutputShape: JSON.stringify({
            passed: "boolean",
            summary: "string",
            issues: [
              {
                checkItem: "string",
                message: "string",
                severity: "low | medium | high",
              },
            ],
          }),
        },
      },
      responseFormat: "json",
      metadata: {
        stage: "implementation_plan",
        checkType: "contract",
      },
    };
  }

  protected buildContractResult(result: ContractExecutionResult): ContractCheckResult {
    return {
      passed: result.passed,
      summary: result.summary,
      issues: result.issues,
    };
  }

  protected checkAgainstPromptRequest(request: LlmExecutionRequest): ContractExecutionResult {
    const promptPayload = JSON.parse(normalizeUserPromptContent(request.prompt.userPrompt)) as {
      generatedResult: string;
      contractSpec: string;
    };
    const content = promptPayload.generatedResult;
    const contractSpec = JSON.parse(promptPayload.contractSpec) as ContractSpec;
    const issues: ContractIssue[] = [];

    if (content.length === 0) {
      issues.push({
        checkItem: "implementation_workplan_not_empty",
        message: "Implementation workplan content must not be empty.",
        severity: "high",
      });
    }

    this.collectStructureIssues(content, contractSpec, issues);
    this.collectWorkflowOrderIssues(content, contractSpec, issues);
    this.collectStepStructureIssues(content, contractSpec, issues);

    return {
      passed: issues.length === 0,
      summary: issues.length === 0
        ? "Implementation workplan passed contract checks."
        : "Implementation workplan failed contract checks.",
      issues,
    };
  }

  private parseModuleDesignDocuments(rawValue: string | undefined): string[] {
    if (!rawValue) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
      return [];
    }

    return parsed;
  }

  private collectStructureIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const requiredHeadings = [
      "## 1. Purpose",
      "## 1.1 Collaboration Rule",
      "## 2. Workflow Delivery Order",
      "## 3. Execution Steps",
    ];
    const structureContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "document_structure_complete",
    );

    for (const heading of requiredHeadings) {
      if (!content.includes(heading)) {
        issues.push({
          checkItem: structureContract?.check_item ?? "document_structure_complete",
          message: `Missing required section: ${heading}`,
          severity: structureContract?.severity ?? "high",
        });
      }
    }
  }

  private collectWorkflowOrderIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const workflowContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "workflow_order_consistency",
    );

    if (!/^\s*1\.\s+/m.test(content) || !/^\s*2\.\s+/m.test(content)) {
      issues.push({
        checkItem: workflowContract?.check_item ?? "workflow_order_consistency",
        message: "Workflow Delivery Order should contain an ordered numbered list.",
        severity: workflowContract?.severity ?? "high",
      });
    }
  }

  private collectStepStructureIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const executionContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "execution_step_structure_consistency",
    );

    if (!/### Step \d+\./.test(content)) {
      issues.push({
        checkItem: executionContract?.check_item ?? "execution_step_structure_consistency",
        message: "Execution Steps should contain step-oriented subsections.",
        severity: executionContract?.severity ?? "high",
      });
    }

    if (!content.includes("Architecture modules in scope")) {
      issues.push({
        checkItem: executionContract?.check_item ?? "execution_step_structure_consistency",
        message: "Each step should include an Architecture modules in scope section.",
        severity: executionContract?.severity ?? "high",
      });
    }

    if (!/Batch 1:/m.test(content)) {
      issues.push({
        checkItem: executionContract?.check_item ?? "execution_step_structure_consistency",
        message: "Each step should include batch-oriented delivery items.",
        severity: executionContract?.severity ?? "high",
      });
    }
  }

  private parseStatus(marker: string, label: string): ImplementationWorkPlanStatus {
    if (marker !== "x") {
      return "not_started";
    }

    return label.includes("partially completed") ? "in_progress" : "completed";
  }
}
