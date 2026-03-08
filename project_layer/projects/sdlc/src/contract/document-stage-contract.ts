import { readFile } from "node:fs/promises";

import type { ContractCheckResult, IContractChecker, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";

export interface ContractSpec {
  document_contracts: DocumentContract[];
  section_contracts: SectionContract[];
  specific_contract?: Record<string, unknown>;
}

export type SpecificContractSpec = Partial<ContractSpec> & Record<string, unknown>;

export interface DocumentContract {
  check_item: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface SectionContract {
  section_id: string;
  title: string;
  checkitems: string[];
  severity: "low" | "medium" | "high";
  expected_format?: string;
}

export interface ContractExecutionResult {
  passed: boolean;
  summary: string;
  issues: ContractCheckResult["issues"];
}

export abstract class DocumentStageContract implements IContractChecker {
  constructor(private readonly llmExecutor?: ILlmExecutor) {}

  async check(context: StageRunContext, output: StageOutput): Promise<ContractCheckResult> {
    const contractSpec = await this.loadSpecificContract();
    const request = await this.buildCheckRequest(context, output, contractSpec);
    const result = await this.executeCheck(request);
    return this.buildContractResult(result);
  }

  protected abstract getContractFilePath(): string;
  protected abstract getStageId(): string;

  protected async refineLoadedContract(baseSpec: ContractSpec): Promise<ContractSpec> {
    return baseSpec;
  }

  protected async loadSpecificContract(): Promise<ContractSpec> {
    const content = await readFile(this.getContractFilePath(), "utf8");
    const parsed = JSON.parse(content) as ContractSpec;
    const baseSpec: ContractSpec = {
      document_contracts: parsed.document_contracts,
      section_contracts: parsed.section_contracts,
      specific_contract: {
        source: this.getContractFilePath().split("meta_layer/")[1]
          ? `meta_layer/${this.getContractFilePath().split("meta_layer/")[1].replaceAll("\\", "/")}`
          : this.getContractFilePath(),
        stage: this.getStageId(),
      },
    };
    return this.refineLoadedContract(baseSpec);
  }

  protected abstract buildCheckRequest(
    context: StageRunContext,
    output: StageOutput,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest>;

  protected async executeCheck(
    request: LlmExecutionRequest,
  ): Promise<ContractExecutionResult> {
    if (this.llmExecutor) {
      const result = await this.llmExecutor.execute(request);
      return this.parseExecutionResult(result);
    }

    return this.checkAgainstPromptRequest(request);
  }

  protected parseExecutionResult(result: LlmExecutionResult): ContractExecutionResult {
    const parsed = JSON.parse(result.content) as Partial<ContractExecutionResult>;
    if (typeof parsed.passed !== "boolean") {
      throw new Error('Contract execution result must contain boolean field "passed".');
    }
    if (typeof parsed.summary !== "string") {
      throw new Error('Contract execution result must contain string field "summary".');
    }
    if (!Array.isArray(parsed.issues)) {
      throw new Error('Contract execution result must contain array field "issues".');
    }

    return {
      passed: parsed.passed,
      summary: parsed.summary,
      issues: parsed.issues.map((issue) => {
        if (!issue || typeof issue !== "object") {
          throw new Error("Contract execution issues must be objects.");
        }

        const candidate = issue as unknown as Record<string, unknown>;
        if (typeof candidate.checkItem !== "string"
          || typeof candidate.message !== "string"
          || (candidate.severity !== "low" && candidate.severity !== "medium" && candidate.severity !== "high")) {
          throw new Error("Contract execution issues must contain checkItem, message, and severity.");
        }

        return {
          checkItem: candidate.checkItem,
          message: candidate.message,
          severity: candidate.severity,
        };
      }),
    };
  }

  protected abstract buildContractResult(result: ContractExecutionResult): ContractCheckResult;

  protected abstract checkAgainstPromptRequest(
    request: LlmExecutionRequest,
  ): ContractExecutionResult;
}
