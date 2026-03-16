import type {
  ContractCheckResult,
  ContractIssue,
  StageOutput,
  StageRunContext,
} from "../shared/contracts/pipeline.js";
import { normalizeUserPromptContent, type LlmExecutionRequest } from "../sdk/llm-executor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "./document-stage-contract.js";
import { DocumentStageContract } from "./document-stage-contract.js";

interface ArchitectureArtifacts {
  artifactKey: "architecture_design" | "architecture_document";
  content: string;
}

export class ArchitectureDesignContract extends DocumentStageContract {
  protected getContractResourcePath(): string {
    return "contract/TechnicalArchitectureTemplate.contract.json";
  }

  protected getStageId(): string {
    return "architecture_design";
  }

  protected async buildCheckRequest(
    _context: StageRunContext,
    output: StageOutput,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const architectureOutput = output as StageOutput<ArchitectureArtifacts>;
    const generatedResult = architectureOutput.artifacts.content.trim();

    return {
      prompt: {
        systemPrompt:
          "You check whether a technical architecture document satisfies the provided contract spec. " +
          "Return JSON with passed, summary, and issues only.",
        userPrompt: {
          target: "architecture_design_contract_check",
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
        stage: "architecture_design",
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
    const content = promptPayload.generatedResult;
    const contractSpec = promptPayload.contractSpec;
    const issues: ContractIssue[] = [];

    if (content.length === 0) {
      issues.push({
        checkItem: "architecture_document_not_empty",
        message: "Architecture document content must not be empty.",
        severity: "high",
      });
    }

    this.collectStructureIssues(content, contractSpec, issues);
    this.collectArchitectureLevelIssues(content, contractSpec, issues);
    this.collectCrossSectionIssues(content, contractSpec, issues);

    return {
      passed: issues.length === 0,
      summary:
        issues.length === 0
          ? "Architecture design document passed contract checks."
          : "Architecture design document failed contract checks.",
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

    const requiredSubsections = [
      "2.1",
      "2.2",
      "4.1",
      "4.2",
      "4.3",
      "4.4",
      "5.1",
      "5.2",
      "5.3",
      "7.1",
      "7.2",
      "8",
    ];

    for (const sectionId of requiredSubsections) {
      const section = contractSpec.section_contracts.find((entry) => entry.section_id === sectionId);
      if (!section) {
        continue;
      }

      const headingCandidates = this.buildHeadingCandidates(section.section_id, section.title);
      if (!headingCandidates.some((heading) => content.includes(heading))) {
        issues.push({
          checkItem: "document_structure_complete",
          message: `Missing required subsection: ${headingCandidates[0]}`,
          severity: section.severity,
        });
      }
    }
  }

  private collectArchitectureLevelIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const levelContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "architecture_level_consistency",
    );

    if (/{[^}]+}/.test(content)) {
      issues.push({
        checkItem: levelContract?.check_item ?? "architecture_level_consistency",
        message: "Architecture document still contains unresolved template placeholders.",
        severity: levelContract?.severity ?? "high",
      });
    }

    const implementationSignals = [
      /\bclass\s+[A-Z]\w*/i,
      /\binterface\s+[A-Z]\w*\s*[{<]/i,
      /\bfunction\s+\w+\s*\(/i,
      /\btable schema\b/i,
      /\bSQL\b/i,
      /\bAPI endpoint\b/i,
    ];

    if (implementationSignals.some((pattern) => pattern.test(content))) {
      issues.push({
        checkItem: levelContract?.check_item ?? "architecture_level_consistency",
        message: "Architecture document appears to contain implementation-level detail.",
        severity: levelContract?.severity ?? "high",
      });
    }
  }

  private collectCrossSectionIssues(content: string, contractSpec: ContractSpec, issues: ContractIssue[]): void {
    const crossSectionContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "cross_section_alignment",
    );

    if (!this.sectionHasListItems(content, "# 4.2 Layers or Partitions")) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: "Layers or Partitions section should list architecture partitions.",
        severity: crossSectionContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsToken(content, "# 4.3 Allowed Dependencies", "ALLOW:")) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: "Allowed Dependencies section should declare ALLOW dependency rules.",
        severity: crossSectionContract?.severity ?? "high",
      });
    }

    if (!this.sectionContainsCodeBlock(content, "# 4.4 High-level Diagram")) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: "High-level Diagram section should include a diagram code block.",
        severity: crossSectionContract?.severity ?? "high",
      });
    }

    if (!this.sectionHasOrderedList(content, "# 5.1 Main Flow")) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: "Main Flow section should contain ordered execution steps.",
        severity: crossSectionContract?.severity ?? "high",
      });
    }

    const layerNames = this.extractNamedBullets(content, "# 4.2 Layers or Partitions");
    const dependencyNodes = this.extractAllowedDependencyNodes(content);
    const unknownDependencyNodes = dependencyNodes.filter((name) => !layerNames.includes(name));
    if (unknownDependencyNodes.length > 0) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: `Allowed Dependencies references undefined layers or partitions: ${unknownDependencyNodes.join(", ")}`,
        severity: crossSectionContract?.severity ?? "high",
      });
    }

    const coreModules = this.extractNamedBullets(content, "# 5.2 Core Modules");
    if (coreModules.length < 3) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: "Core Modules section should list the major modules needed to understand the architecture.",
        severity: crossSectionContract?.severity ?? "high",
      });
    }

    const documentCategoriesSection = this.extractSection(content, "# 7.1 Design Document Categories");
    const categoryTokens = ["requirement", "architecture", "module", "implementation"];
    if (!categoryTokens.every((token) => documentCategoriesSection.toLowerCase().includes(token))) {
      issues.push({
        checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
        message: "Design Document Categories section should cover requirement, architecture, module, and implementation documents.",
        severity: crossSectionContract?.severity ?? "high",
      });
    }
  }

  private buildHeadingCandidates(sectionId: string, title: string): string[] {
    const depth = sectionId.split(".").length;
    const headingPrefix = "#".repeat(Math.min(depth, 3));
    return [`${headingPrefix} ${sectionId}. ${title}`, `${headingPrefix} ${sectionId} ${title}`];
  }

  private sectionHasListItems(content: string, heading: string): boolean {
    const section = this.extractSection(content, heading);
    return /^\s*-\s+/m.test(section);
  }

  private sectionContainsToken(content: string, heading: string, token: string): boolean {
    return this.extractSection(content, heading).includes(token);
  }

  private sectionContainsCodeBlock(content: string, heading: string): boolean {
    return /```[\s\S]+```/.test(this.extractSection(content, heading));
  }

  private sectionHasOrderedList(content: string, heading: string): boolean {
    return /^\s*1\.\s+/m.test(this.extractSection(content, heading));
  }

  private extractNamedBullets(content: string, heading: string): string[] {
    const section = this.extractSection(content, heading);
    const matches = [...section.matchAll(/^\s*-\s+([^:\n]+):/gm)];
    return matches.map((match) => match[1].trim());
  }

  private extractAllowedDependencyNodes(content: string): string[] {
    const section = this.extractSection(content, "# 4.3 Allowed Dependencies");
    const nodes = new Set<string>();
    const matches = [...section.matchAll(/-\s+([^-\n]+?)\s*->\s*([^\n]+)/g)];
    for (const match of matches) {
      nodes.add(match[1].trim());
      nodes.add(match[2].trim());
    }
    return [...nodes];
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
