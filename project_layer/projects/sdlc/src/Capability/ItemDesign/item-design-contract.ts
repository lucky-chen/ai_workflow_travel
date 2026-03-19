import type {
  ContractCheckResult,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import type { ILlmExecutor, LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../../Capability/Shared/document-unit-contract.js";
import { DocumentUnitContract } from "../../Capability/Shared/document-unit-contract.js";
import { runMarkdownDocumentStaticChecks } from "../../Capability/Shared/document-contract-static-checker.js";

interface ItemDesignArtifacts {
  artifactKey: "item_design_document";
  moduleName: string;
  content: string;
}

export class ItemDesignContract extends DocumentUnitContract {
  constructor(llmExecutor?: ILlmExecutor) {
    super(llmExecutor);
  }

  protected getContractResourcePath(): string {
    return "contract/ItemDesignTemplate.contract.json";
  }

  protected getExecutionUnitId(): string {
    return "item_design";
  }

  protected collectStaticIssues(
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ) {
    const itemDesignOutput = output as ExecutionUnitResult<ItemDesignArtifacts>;
    return runMarkdownDocumentStaticChecks(itemDesignOutput.artifacts.content.trim(), contractSpec);
  }

  protected skipSemanticFallbackWithoutLlm(): boolean {
    return true;
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
}
