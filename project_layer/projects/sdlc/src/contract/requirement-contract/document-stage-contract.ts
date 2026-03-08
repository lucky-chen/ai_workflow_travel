import type { ContractCheckResult, IContractChecker, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";

export interface ContractSpec {
  document_contracts: DocumentContract[];
  section_contracts: SectionContract[];
}

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

export interface ContractCheckRequest {
  generatedResult: string;
  contractSpec: ContractSpec;
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
  protected abstract loadSpecificContract(): Promise<ContractSpec>;

  protected resolveContractRules(sharedContract: ContractSpec, specificContract: ContractSpec): ContractSpec {
    return {
      document_contracts: [...sharedContract.document_contracts, ...specificContract.document_contracts],
      section_contracts: [...sharedContract.section_contracts, ...specificContract.section_contracts],
    };
  }

  protected abstract buildCheckRequest(
    context: StageRunContext,
    output: StageOutput,
    contractSpec: ContractSpec,
  ): Promise<ContractCheckRequest>;

  protected async executeCheck(
    request: ContractCheckRequest,
  ): Promise<ContractExecutionResult> {
    return this.checkAgainstContractSpec(request.generatedResult, request.contractSpec);
  }

  protected abstract buildContractResult(result: ContractExecutionResult): ContractCheckResult;

  protected abstract checkAgainstContractSpec(
    generatedResult: string,
    contractSpec: ContractSpec,
  ): ContractExecutionResult;
}
