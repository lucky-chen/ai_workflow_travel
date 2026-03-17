import type {
  ContractCheckResult,
  ContractIssue,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import { loadItemDesignTemplateSpec } from "./item-design-template-spec.js";
import { normalizeUserPromptContent, type LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../../Capability/Shared/document-unit-contract.js";
import { DocumentUnitContract } from "../../Capability/Shared/document-unit-contract.js";

interface ItemDesignArtifacts {
  artifactKey: "item_design_document";
  moduleName: string;
  content: string;
}

export class ItemDesignContract extends DocumentUnitContract {
  protected getContractResourcePath(): string {
    return "template/ItemDesignTemplate.md";
  }

  protected getExecutionUnitId(): string {
    return "item_design";
  }

  protected async loadSpecificContract(context?: ExecutionContext): Promise<ContractSpec> {
    return (await loadItemDesignTemplateSpec(
      context?.workspaceRoot,
      context?.params?.resourceRoot,
    )).contractSpec;
  }

  protected async buildCheckRequest(
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const itemDesignOutput = output as ExecutionUnitResult<ItemDesignArtifacts>;
    const generatedResult = itemDesignOutput.artifacts.content.trim();

    return {
      prompt: {
        systemPrompt:
          "You check whether an item design document satisfies the provided contract spec. " +
          "Return JSON with passed, summary, and issues only.",
        userPrompt: {
          target: "item_design_contract_check",
          itemName: itemDesignOutput.artifacts.moduleName,
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
        executionUnit: "item_design_contract",
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
      itemName: string;
      generatedResult: string;
      contractSpec: ContractSpec;
    };
    const content = promptPayload.generatedResult;
    const itemName = promptPayload.itemName;
    const contractSpec = promptPayload.contractSpec;
    const issues: ContractIssue[] = [];

    if (content.length === 0) {
      issues.push({
        checkItem: "item_design_document_not_empty",
        message: "Item design document content must not be empty.",
        severity: "high",
      });
    }

    this.collectStructureIssues(content, contractSpec, issues);
    this.collectSectionContractAlignmentIssues(content, contractSpec, issues);
    this.collectItemConsistencyIssues(content, itemName, contractSpec, issues);

    return {
      passed: issues.length === 0,
      summary: issues.length === 0
        ? "Item design document passed contract checks."
        : "Item design document failed contract checks.",
      issues,
    };
  }

  private collectStructureIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const requiredSections = ["2", "2.1", "3", "3.1", "4.1", "4.1.1", "4.1.2", "4.1.4", "4.2"];

    for (const sectionId of requiredSections) {
      const section = contractSpec.section_contracts.find((entry) => entry.section_id === sectionId);
      if (!section) {
        continue;
      }

      const headingCandidates = this.buildHeadingCandidates(section.section_id, section.title);
      if (!headingCandidates.some((heading) => content.includes(heading))) {
        issues.push({
          checkItem: "document_structure_complete",
          message: `Missing required section: ${headingCandidates[0]}`,
          severity: section.severity,
        });
      }
    }
  }

  private collectSectionContractAlignmentIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const alignmentContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "section_contract_alignment",
    );

    if (!this.sectionContainsCodeBlock(content, "### 2.1 Class Diagram", "plantuml")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "section_contract_alignment",
        message: "Class Diagram section should include a PlantUML code block.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsCodeBlock(content, "### 3.1 Main Sequence Diagram", "plantuml")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "section_contract_alignment",
        message: "Main Sequence Diagram section should include a PlantUML code block.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsCodeBlock(content, "#### 4.1.2 Input Types", ["ts", "typescript"])) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "section_contract_alignment",
        message: "Input Types section should define input structure in a TypeScript code block.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsCodeBlock(content, "#### 4.1.4 Output Types", ["ts", "typescript"])) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "section_contract_alignment",
        message: "Output Types section should define output structure in a TypeScript code block.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (this.hasNonCodeProse(this.extractSection(content, "#### 4.1.2 Input Types"))) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "section_contract_alignment",
        message: "Input Types section should not describe structure with prose outside code blocks.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (this.hasNonCodeProse(this.extractSection(content, "#### 4.1.4 Output Types"))) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "section_contract_alignment",
        message: "Output Types section should not describe structure with prose outside code blocks.",
        severity: alignmentContract?.severity ?? "high",
      });
    }
  }

  private collectItemConsistencyIssues(
    content: string,
    itemName: string,
    contractSpec: ContractSpec,
    issues: ContractIssue[],
  ): void {
    const formatContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "format_consistency",
    );

    if (!content.includes(`# ${itemName} Design`)) {
      issues.push({
        checkItem: formatContract?.check_item ?? "format_consistency",
        message: `Document title should match item name "${itemName}".`,
        severity: formatContract?.severity ?? "medium",
      });
    }

    const involvedModulesSection = this.extractSection(content, "### 1.2 Involved Modules");
    if (!involvedModulesSection.includes("This module design directly involves:")) {
      issues.push({
        checkItem: formatContract?.check_item ?? "format_consistency",
        message: "Involved Modules section should explicitly list direct and collaborating items.",
        severity: formatContract?.severity ?? "medium",
      });
    }

    if (!content.includes("### 2.2 Core Class Responsibilities")
      || !content.includes("Role:")
      || !content.includes("Responsibilities:")) {
      issues.push({
        checkItem: formatContract?.check_item ?? "format_consistency",
        message: "Core Class Responsibilities section should include Role and Responsibilities blocks.",
        severity: formatContract?.severity ?? "medium",
      });
    }

    const constraintsSection = this.extractSection(content, "### 4.6 Constraints");
    if (!/^\s*-\s+/m.test(constraintsSection)) {
      issues.push({
        checkItem: formatContract?.check_item ?? "format_consistency",
        message: "Constraints section should list explicit constraint bullets.",
        severity: formatContract?.severity ?? "medium",
      });
    }
  }

  private buildHeadingCandidates(sectionId: string, title: string): string[] {
    const candidates = new Set<string>();
    const commonPrefixes = ["##", "###", "####"];
    for (const prefix of commonPrefixes) {
      candidates.add(`${prefix} ${sectionId}. ${title}`);
      candidates.add(`${prefix} ${sectionId} ${title}`);
    }
    return [...candidates];
  }

  private sectionContainsCodeBlock(content: string, heading: string, languages: string | string[]): boolean {
    const section = this.extractSection(content, heading);
    const accepted = Array.isArray(languages) ? languages : [languages];
    return accepted.some((language) => {
      const pattern = new RegExp("```" + language + "[\\s\\S]+?```");
      return pattern.test(section);
    });
  }

  private hasNonCodeProse(section: string): boolean {
    const lines = section
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (!inCodeBlock) {
        return true;
      }
    }

    return false;
  }

  private extractSection(content: string, heading: string): string {
    const startIndex = content.indexOf(heading);
    if (startIndex < 0) {
      return "";
    }

    const rest = content.slice(startIndex + heading.length);
    const nextHeadingOffset = rest.search(/\n#{1,4} /);
    if (nextHeadingOffset < 0) {
      return rest;
    }

    return rest.slice(0, nextHeadingOffset);
  }
}
