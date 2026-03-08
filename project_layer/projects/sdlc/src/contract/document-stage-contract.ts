import type { ContractCheckResult, IContractChecker, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";
import type { LlmExecutionRequest } from "../sdk/llm-executor/llm-executor.js";

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
  async check(context: StageRunContext, output: StageOutput): Promise<ContractCheckResult> {
    const sharedContract = await this.loadSharedContract();
    const specificContract = await this.loadSpecificContract();
    const contractSpec = this.resolveContractRules(sharedContract, specificContract);
    const request = await this.buildCheckRequest(context, output, contractSpec);
    const result = await this.executeCheck(request);
    return this.buildContractResult(result);
  }

  protected abstract loadSharedContract(): Promise<ContractSpec>;
  protected abstract loadSpecificContract(): Promise<SpecificContractSpec>;

  protected resolveContractRules(sharedContract: ContractSpec, specificContract: SpecificContractSpec): ContractSpec {
    const specificDocumentContracts = Array.isArray(specificContract.document_contracts)
      ? specificContract.document_contracts
      : [];
    const specificSectionContracts = Array.isArray(specificContract.section_contracts)
      ? specificContract.section_contracts
      : [];
    const { document_contracts, section_contracts, specific_contract, ...remainingSpecificFields } = specificContract;

    return {
      document_contracts: [...sharedContract.document_contracts, ...specificDocumentContracts],
      section_contracts: [...sharedContract.section_contracts, ...specificSectionContracts],
      specific_contract: {
        ...(sharedContract.specific_contract ?? {}),
        ...(specific_contract ?? {}),
        ...remainingSpecificFields,
      },
    };
  }

  protected abstract buildCheckRequest(
    context: StageRunContext,
    output: StageOutput,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest>;

  protected async executeCheck(
    request: LlmExecutionRequest,
  ): Promise<ContractExecutionResult> {
    return this.checkAgainstPromptRequest(request);
  }

  protected abstract buildContractResult(result: ContractExecutionResult): ContractCheckResult;

  protected abstract checkAgainstPromptRequest(
    request: LlmExecutionRequest,
  ): ContractExecutionResult;
}
