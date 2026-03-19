import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ContractCheckResult,
  ContractIssue,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import type { ILlmExecutor, LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../../Capability/Shared/document-unit-contract.js";
import { DocumentUnitContract } from "../../Capability/Shared/document-unit-contract.js";
import { runMarkdownDocumentStaticChecks } from "../../Capability/Shared/document-contract-static-checker.js";
import { parseDesignDocumentBreakdown } from "../Shared/design-document-breakdown.js";

interface ArchitectureArtifacts {
  artifactKey: "architecture_design";
  content: string;
}

export class ArchitectureDesignContract extends DocumentUnitContract {
  constructor(llmExecutor?: ILlmExecutor) {
    super(llmExecutor);
  }

  protected getContractResourcePath(): string {
    return "contract/TechnicalArchitectureTemplate.contract.json";
  }

  protected getExecutionUnitId(): string {
    return "architecture_design";
  }

  protected collectStaticIssues(
    context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ) {
    const architectureOutput = output as ExecutionUnitResult<ArchitectureArtifacts>;
    const content = architectureOutput.artifacts.content.trim();
    const issues = runMarkdownDocumentStaticChecks(content, contractSpec);
    return this.collectBreakdownIssues(context, content, contractSpec, issues);
  }

  protected skipSemanticFallbackWithoutLlm(): boolean {
    return true;
  }

  protected async buildCheckRequest(
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const architectureOutput = output as ExecutionUnitResult<ArchitectureArtifacts>;
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
        executionUnit: "architecture_design_contract",
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

  private collectBreakdownIssues(
    context: ExecutionContext,
    content: string,
    contractSpec: ContractSpec,
    issues: ContractIssue[],
  ): Promise<ContractIssue[]> | ContractIssue[] {
    const referencedPaths = new Set(
      parseDesignDocumentBreakdown(content)
        .map((entry) => path.posix.normalize(entry.documentPath)),
    );
    if (referencedPaths.size === 0) {
      return issues;
    }

    const breakdownPath = path.join(
      context.workspaceRoot,
      "sdlc",
      "docs",
      "architecture_design_breakdown.json",
    );
    const crossSectionContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "cross_section_alignment",
    );

    return this.readAndCompareBreakdownFile(breakdownPath, referencedPaths, issues, crossSectionContract);
  }

  private async readAndCompareBreakdownFile(
    breakdownPath: string,
    referencedPaths: Set<string>,
    issues: ContractIssue[],
    crossSectionContract: ContractSpec["document_contracts"][number] | undefined,
  ): Promise<ContractIssue[]> {
    let parsedBreakdown: unknown;
    try {
      parsedBreakdown = JSON.parse(await readFile(breakdownPath, "utf8"));
    } catch {
      return [
        ...issues,
        this.buildCrossSectionIssue(
          crossSectionContract,
          "Missing or invalid architecture_design_breakdown.json for 7.2 Design Document Breakdown.",
        ),
      ];
    }

    if (!Array.isArray(parsedBreakdown)) {
      return [
        ...issues,
        this.buildCrossSectionIssue(
          crossSectionContract,
          "architecture_design_breakdown.json must be a JSON array.",
        ),
      ];
    }

    const breakdownPaths = new Set(
      parsedBreakdown
        .map((entry) => (entry && typeof entry === "object" ? (entry as { documentPath?: unknown }).documentPath : null))
        .filter((documentPath): documentPath is string => typeof documentPath === "string")
        .map((documentPath) => path.posix.normalize(documentPath)),
    );

    const missingInJson = [...referencedPaths].filter((documentPath) => !breakdownPaths.has(documentPath));
    if (missingInJson.length === 0) {
      return issues;
    }

    return [
      ...issues,
      this.buildCrossSectionIssue(
        crossSectionContract,
        `architecture_design_breakdown.json is missing documentPath entries referenced in 7.2 Design Document Breakdown: ${missingInJson.join(", ")}`,
      ),
    ];
  }

  private buildCrossSectionIssue(
    contract: ContractSpec["document_contracts"][number] | undefined,
    message: string,
  ): ContractIssue {
    return {
      checkItem: contract?.check_item ?? "cross_section_alignment",
      message,
      severity: contract?.severity ?? "high",
    };
  }
}
