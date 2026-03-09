import type {
  ContractCheckResult,
  ContractIssue,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { LlmExecutionRequest } from "../../sdk/llm-executor/llm-executor.js";
import type { RequirementArtifacts } from "../../execution/requirement-generator/requirement-generator.js";
import {
  DocumentStageContract,
  type ContractSpec,
  type ContractExecutionResult,
} from "../document-stage-contract.js";

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
        userPrompt: JSON.stringify(
          {
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
          null,
          2,
        ),
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
    const promptPayload = JSON.parse(request.prompt.userPrompt) as {
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
    for (const section of contractSpec.section_contracts.filter((entry) => !entry.section_id.includes("."))) {
      const headingCandidates = [`# ${section.section_id}. ${section.title}`, `# ${section.section_id} ${section.title}`];
      if (!headingCandidates.some((heading) => content.includes(heading))) {
        issues.push({
          checkItem: "document_structure_complete",
          message: `Missing required heading for section ${section.section_id}: ${section.title}`,
          severity: "high",
        });
      }
    }

    for (const section of contractSpec.section_contracts.filter((entry) => entry.section_id.includes("."))) {
      const headingPrefix = this.buildSubsectionHeading(section.section_id, section.title);
      if (headingPrefix && !content.includes(headingPrefix)) {
        issues.push({
          checkItem: "document_structure_complete",
          message: `Missing required subsection: ${headingPrefix}`,
          severity: "medium",
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
      (entry) => entry.check_item === "workflow_and_goal_alignment",
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

    if (!this.sectionHasHeadingPrefix(content, "# 5. User Workflow", "### 5.1.")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "User Workflow section should describe ordered workflow stages.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionHasListItems(content, "# 8. Success Criteria")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Success Criteria section should include measurable success items.",
        severity: alignmentContract?.severity ?? "high",
      });
    }
  }

  private buildSubsectionHeading(sectionId: string, title: string): string | null {
    if (title.startsWith("{")) {
      return null;
    }

    const depth = sectionId.split(".").length;
    const headingPrefix = "#".repeat(Math.min(depth, 3));
    return `${headingPrefix} ${sectionId} ${title}`.replace("  ", " ").trim();
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
