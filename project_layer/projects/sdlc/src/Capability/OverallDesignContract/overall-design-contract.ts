import path from "node:path";

import type {
  ContractCheckResult,
  ContractIssue,
  ExecutionContext,
  ExecutionUnitResult,
  IContractChecker,
} from "../../Runtime/Unit/execution-unit.js";

interface OverallDesignArtifacts {
  requirement_design: string;
  architecture_design: string;
  item_design_documents: string;
  architecture_design_breakdown?: string;
}

interface ItemDesignDocumentEntry {
  path: string;
  content: string;
}

interface ArchitectureBreakdownEntry {
  documentPath: string;
}

export class OverallDesignContract implements IContractChecker {
  async check(_context: ExecutionContext, output: ExecutionUnitResult): Promise<ContractCheckResult> {
    const artifacts = output.artifacts as Partial<OverallDesignArtifacts>;
    const issues: ContractIssue[] = [];

    const requirementDocument = this.readNonEmptyString(artifacts.requirement_design);
    if (!requirementDocument) {
      issues.push(this.createIssue(
        "overall_design_requirement_present",
        'Overall design contract requires a non-empty "requirement_design" artifact.',
      ));
    }

    const architectureDocument = this.readNonEmptyString(artifacts.architecture_design);
    if (!architectureDocument) {
      issues.push(this.createIssue(
        "overall_design_architecture_present",
        'Overall design contract requires a non-empty "architecture_design" artifact.',
      ));
    }

    const itemDesignDocuments = this.parseItemDesignDocuments(artifacts.item_design_documents, issues);
    if (itemDesignDocuments.length === 0) {
      issues.push(this.createIssue(
        "overall_design_item_documents_present",
        "Overall design contract requires at least one item design document.",
      ));
    }

    const architectureBreakdown = this.parseArchitectureBreakdown(artifacts.architecture_design_breakdown, issues);
    if (architectureBreakdown.length > 0 && itemDesignDocuments.length > 0) {
      this.collectBreakdownCoverageIssues(architectureBreakdown, itemDesignDocuments, issues);
    }

    return {
      passed: issues.length === 0,
      summary: issues.length === 0
        ? "Overall design contract passed."
        : "Overall design contract failed.",
      issues,
    };
  }

  private parseItemDesignDocuments(
    rawValue: string | undefined,
    issues: ContractIssue[],
  ): ItemDesignDocumentEntry[] {
    const value = this.readNonEmptyString(rawValue);
    if (!value) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      issues.push(this.createIssue(
        "overall_design_item_documents_json",
        'Artifact "item_design_documents" must be valid JSON.',
      ));
      return [];
    }

    if (!Array.isArray(parsed)) {
      issues.push(this.createIssue(
        "overall_design_item_documents_json",
        'Artifact "item_design_documents" must be a JSON array.',
      ));
      return [];
    }

    const entries = parsed.filter((entry): entry is ItemDesignDocumentEntry =>
      !!entry
      && typeof entry === "object"
      && typeof (entry as { path?: unknown }).path === "string"
      && typeof (entry as { content?: unknown }).content === "string",
    );

    if (entries.length !== parsed.length) {
      issues.push(this.createIssue(
        "overall_design_item_documents_shape",
        'Artifact "item_design_documents" entries must contain string "path" and "content" fields.',
      ));
    }

    return entries;
  }

  private parseArchitectureBreakdown(
    rawValue: string | undefined,
    issues: ContractIssue[],
  ): ArchitectureBreakdownEntry[] {
    const value = this.readNonEmptyString(rawValue);
    if (!value) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      issues.push(this.createIssue(
        "overall_design_breakdown_json",
        'Artifact "architecture_design_breakdown" must be valid JSON when provided.',
      ));
      return [];
    }

    if (!Array.isArray(parsed)) {
      issues.push(this.createIssue(
        "overall_design_breakdown_json",
        'Artifact "architecture_design_breakdown" must be a JSON array when provided.',
      ));
      return [];
    }

    const entries = parsed.filter((entry): entry is ArchitectureBreakdownEntry =>
      !!entry
      && typeof entry === "object"
      && typeof (entry as { documentPath?: unknown }).documentPath === "string",
    );

    if (entries.length !== parsed.length) {
      issues.push(this.createIssue(
        "overall_design_breakdown_shape",
        'Artifact "architecture_design_breakdown" entries must contain string "documentPath" fields.',
      ));
    }

    return entries;
  }

  private collectBreakdownCoverageIssues(
    breakdownEntries: ArchitectureBreakdownEntry[],
    itemDesignDocuments: ItemDesignDocumentEntry[],
    issues: ContractIssue[],
  ): void {
    const itemPaths = new Set(itemDesignDocuments.map((entry) => path.normalize(entry.path)));
    const missingDocumentPaths = breakdownEntries
      .map((entry) => path.normalize(entry.documentPath))
      .filter((documentPath) => !itemPaths.has(documentPath));

    if (missingDocumentPaths.length > 0) {
      issues.push(this.createIssue(
        "overall_design_breakdown_coverage",
        `Architecture breakdown references item design documents that are missing: ${missingDocumentPaths.join(", ")}`,
      ));
    }
  }

  private readNonEmptyString(value: string | undefined): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  private createIssue(checkItem: string, message: string): ContractIssue {
    return {
      checkItem,
      message,
      severity: "high",
    };
  }
}
