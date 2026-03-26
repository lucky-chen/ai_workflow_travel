import { readFile } from "node:fs/promises";

import { getContractFilePath } from "./resource-paths.js";
import type { ContractSpec } from "./document-unit-contract.js";

const contractSpecCache = new Map<string, ContractSpec>();

export async function loadContractSpecFromJson(
  workspaceRoot: string,
  contractFileName: string,
  executionUnit: string,
  resourceRoot?: string,
): Promise<ContractSpec> {
  const contractFilePath = getContractFilePath(workspaceRoot, contractFileName, resourceRoot);
  const cached = contractSpecCache.get(contractFilePath);
  const parsed = cached ?? JSON.parse(await readFile(contractFilePath, "utf8")) as ContractSpec;
  if (!cached) {
    contractSpecCache.set(contractFilePath, parsed);
  }

  return {
    document_contracts: parsed.document_contracts,
    section_contracts: parsed.section_contracts,
    specific_contract: {
      ...parsed.specific_contract,
      source: `contract/${contractFileName}`,
      executionUnit,
    },
  };
}

export function findDocumentContract(
  contractSpec: ContractSpec,
  checkItem: string,
): ContractSpec["document_contracts"][number] | undefined {
  return contractSpec.document_contracts.find((entry) => entry.check_item === checkItem);
}
