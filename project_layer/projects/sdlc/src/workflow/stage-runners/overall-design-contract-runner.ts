import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";

import type { StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import { resolveOverallDesignContractResultArtifactPath } from "./stage-artifact-paths.js";

export class OverallDesignContractRunner extends BaseStageRunner {
  constructor(dependencies: BaseStageRunnerDependencies = {}) {
    super(dependencies);
  }

  async run(
    context: StageRunContext,
  ): Promise<StageOutput<{ overall_design_contract_result: string; contract_result: string }>> {
    await this.recordStageStart(context);

    const contractResult = this.buildContractResult(context);
    const contractResultPath = resolveOverallDesignContractResultArtifactPath(context.workspaceRoot);
    await this.writeWorkspaceFile(context, contractResultPath, JSON.stringify(contractResult, null, 2));
    await this.recordSharedPersistenceResult(
      context,
      contractResultPath,
      `Accepted overall-design contract artifact persisted to ${contractResultPath}.`,
    );

    return {
      stageId: "overall_design_contract",
      success: contractResult.passed,
      summary: contractResult.summary,
      artifacts: {
        overall_design_contract_result: contractResultPath,
        contract_result: JSON.stringify(contractResult),
      },
    };
  }

  private buildContractResult(context: StageRunContext): {
    passed: boolean;
    summary: string;
    issues: Array<{ checkItem: string; message: string; severity: "high" }>;
  } {
    const issues: Array<{ checkItem: string; message: string; severity: "high" }> = [];

    if (!context.inputArtifacts.requirement_document?.trim()) {
      issues.push({
        checkItem: "requirement_design_input_present",
        message: 'Missing required input artifact "requirement_document".',
        severity: "high",
      });
    }

    if (!(context.inputArtifacts.architecture_design ?? context.inputArtifacts.architecture_document)?.trim()) {
      issues.push({
        checkItem: "architecture_design_input_present",
        message: 'Missing required input artifact "architecture_design" or "architecture_document".',
        severity: "high",
      });
    }

    const itemDesignDocuments = this.parseItemDesignDocuments(
      context.inputArtifacts.item_design_documents ?? context.inputArtifacts.module_design_documents,
    );
    if (itemDesignDocuments.length === 0) {
      issues.push({
        checkItem: "item_design_inputs_present",
        message: 'Missing required input artifact "item_design_documents" or "module_design_documents".',
        severity: "high",
      });
    }

    return {
      passed: issues.length === 0,
      summary: issues.length === 0
        ? "Overall design contract passed."
        : "Overall design contract failed.",
      issues,
    };
  }

  private parseItemDesignDocuments(rawValue: string | undefined): string[] {
    if (!rawValue?.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string" || entry.length === 0)) {
        return [];
      }

      return parsed;
    } catch {
      return [];
    }
  }
}
