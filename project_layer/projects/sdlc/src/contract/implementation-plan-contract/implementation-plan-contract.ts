import path from "node:path";

import type {
  ContractCheckResult,
  ContractIssue,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { LlmExecutionRequest } from "../../sdk/llm-executor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../document-stage-contract.js";
import { DocumentStageContract } from "../document-stage-contract.js";

const IMPLEMENTATION_PLAN_CONTRACT_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "..",
  "meta_layer",
  "resources",
  "contract",
  "CodeGenerationExecutionPlanTemplate.contract.json",
);

interface ImplementationPlanArtifacts {
  artifactKey: "implementation_workplan";
  content: string;
}

export class ImplementationPlanContract extends DocumentStageContract {
  protected getContractFilePath(): string {
    return IMPLEMENTATION_PLAN_CONTRACT_PATH;
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
        userPrompt: JSON.stringify(
          {
            target: "implementation_plan_contract_check",
            generatedResult,
            contractSpec,
            upstreamContext: {
              requirement_document: context.inputArtifacts.requirement_document,
              architecture_document: context.inputArtifacts.architecture_document,
              module_design_documents: moduleDesignDocuments,
            },
            requiredOutputShape: {
              passed: "boolean",
              summary: "string",
              issues: [
                {
                  checkItem: "string",
                  message: "string",
                  severity: "low | medium | high",
                },
              ],
            },
          },
          null,
          2,
        ),
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
    const promptPayload = JSON.parse(request.prompt.userPrompt) as {
      generatedResult: string;
      contractSpec: ContractSpec;
    };
    const content = promptPayload.generatedResult;
    const contractSpec = promptPayload.contractSpec;
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
}
