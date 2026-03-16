import type {
  ContractCheckResult,
  ContractIssue,
  StageOutput,
  StageRunContext,
} from "../shared/contracts/pipeline.js";
import { normalizeUserPromptContent, type LlmExecutionRequest } from "../sdk/llm-executor/llm-executor.js";
import type { RequirementArtifacts } from "../execution/requirement-generator.js";
import {
  DocumentStageContract,
  type ContractSpec,
  type ContractExecutionResult,
} from "./document-stage-contract.js";

export class RequirementContract extends DocumentStageContract {
  protected getContractResourcePath(): string {
    return "contract/RequirementTemplate.contract.json";
  }

  protected getStageId(): string {
    return "requirement_interpretation";
  }

  protected async buildCheckRequest(
    _context: StageRunContext,
    output: StageOutput,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const requirementOutput = output as StageOutput<RequirementArtifacts>;
    const generatedResult = requirementOutput.artifacts.content.trim();

    return {
      prompt: {
        systemPrompt:
          "You check whether a requirement document satisfies the provided contract spec. " +
          "Return JSON with passed, summary, and issues only.",
        userPrompt: {
          target: "requirement_contract_check",
          generatedResult,
          contractSpec,
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
      },
      responseFormat: "json",
      metadata: {
        stage: "requirement_interpretation",
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
      contractSpec: ContractSpec;
    };
    const generatedResult = promptPayload.generatedResult;
    const contractSpec = promptPayload.contractSpec;
    const issues: ContractIssue[] = [];

    if (generatedResult.length === 0) {
      issues.push({
        checkItem: "requirement_document_not_empty",
        message: "Requirement document content must not be empty.",
        severity: "high",
      });
    }

    this.collectStructureIssues(generatedResult, contractSpec, issues);
    this.collectRequirementScopeIssues(generatedResult, contractSpec, issues);
    this.collectAlignmentIssues(generatedResult, contractSpec, issues);

    return {
      passed: issues.length === 0,
      summary:
        issues.length === 0 ? "Requirement document passed contract checks." : "Requirement document failed contract checks.",
      issues,
    };
  }

  private collectStructureIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const structureContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "document_structure_complete",
    );
    const requiredHeadings = [
      "# 1. Background",
      "# 2. User Scenarios",
      "# 3. Product Goals",
      "# 4. Core Problems and Product Abilities",
      "# 5. Core Functional Points",
      "# 6. User Scenarios",
      "# 7. Inputs and Outputs",
      "# 8 Scope and Non-Goals",
    ];
    const requiredSubsections = [
      "## 2.1",
      "## 2.2",
      "## 2.3",
      "## 4.1",
      "## 4.2",
      "## 4.3",
      "## 4.4",
      "## 4.5",
      "## 5.1",
      "## 5.2",
      "## 5.3",
      "## 6.1",
      "## 6.2",
      "## 7.1",
      "## 7.2",
      "## 7.3",
      "## 7.4",
      "## 8.1",
      "## 8.2",
      "## 8.3",
    ];

    for (const heading of requiredHeadings) {
      if (!content.includes(heading)) {
        issues.push({
          checkItem: structureContract?.check_item ?? "document_structure_complete",
          message: `Missing required section: ${heading}`,
          severity: structureContract?.severity ?? "high",
        });
      }
    }

    for (const heading of requiredSubsections) {
      if (!content.includes(heading)) {
        issues.push({
          checkItem: structureContract?.check_item ?? "document_structure_complete",
          message: `Missing required subsection: ${heading}`,
          severity: structureContract?.severity ?? "high",
        });
      }
    }
  }

  private collectRequirementScopeIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const scopeContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "requirement_scope_consistency",
    );
    if (/{[^}]+}/.test(content)) {
      issues.push({
        checkItem: scopeContract?.check_item ?? "requirement_scope_consistency",
        message: "Requirement document still contains unresolved template placeholders.",
        severity: scopeContract?.severity ?? "high",
      });
    }

    const implementationSignals = [
      /\bclass\s+\w+/i,
      /\binterface\s+\w+/i,
      /\bfunction\s+\w+/i,
      /\btable schema\b/i,
      /\bSQL\b/i,
      /\bAPI endpoint\b/i,
    ];

    if (implementationSignals.some((pattern) => pattern.test(content))) {
      issues.push({
        checkItem: scopeContract?.check_item ?? "requirement_scope_consistency",
        message: "Requirement document appears to contain implementation-level detail.",
        severity: scopeContract?.severity ?? "high",
      });
    }
  }

  private collectAlignmentIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const alignmentContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "workflow_and_goal_alignment" || entry.check_item === "journey_and_goal_alignment",
    );
    if (!this.sectionHasListItems(content, "# 3. Product Goals")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Product Goals section should include concrete goal items.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsAll(content, "# 4. Core Problems and Product Abilities", ["problem:", "ability:"])) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Core Problems and Product Abilities section should contain problem and ability pairs.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsAll(
      content,
      "# 5. Core Functional Points",
      ["[requirement_design_generate]", "[work_execute_contract]", "[gate]", "[trace]"],
    )) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Core Functional Points section should define the canonical functional point names.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsAll(
      content,
      "## 6.1 Standard Scenario",
      ["[requirement_design_generate]", "[architecture_design_generate]", "[item_design_generate]", "[work_plan_generate]", "[work_execute]"],
    )) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Standard Scenario section should cover the main functional-point flow.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsAll(
      content,
      "# 7. Inputs and Outputs",
      ["[requirement_design_generate]", "[work_execute_contract]"],
    )) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Inputs and Outputs section should map the declared functional points to concrete inputs and outputs.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsAll(content, "# 8 Scope and Non-Goals", ["## 8.1", "## 8.2", "## 8.3"])) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Scope and Non-Goals section should define V1, V2, and V3 milestones.",
        severity: alignmentContract?.severity ?? "high",
      });
    }
  }

  private sectionHasListItems(content: string, heading: string): boolean {
    const section = this.extractSection(content, heading);
    return /^\s*-\s+/m.test(section);
  }

  private sectionContainsAll(content: string, heading: string, requiredTokens: string[]): boolean {
    const section = this.extractSection(content, heading).toLowerCase();
    return requiredTokens.every((token) => section.includes(token));
  }

  private sectionHasHeadingPrefix(content: string, heading: string, prefix: string): boolean {
    const section = this.extractSection(content, heading);
    return section.includes(prefix);
  }

  private extractSection(content: string, heading: string): string {
    const startIndex = content.indexOf(heading);
    if (startIndex < 0) {
      return "";
    }

    const rest = content.slice(startIndex + heading.length);
    const nextHeadingOffset = rest.search(/\n# /);
    if (nextHeadingOffset < 0) {
      return rest;
    }

    return rest.slice(0, nextHeadingOffset);
  }
}
