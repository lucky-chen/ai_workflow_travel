import type {
  ContractCheckResult,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import type { ILlmExecutor, LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { RequirementArtifacts } from "./requirement-generator.js";
import {
  DocumentUnitContract,
  type ContractSpec,
  type ContractExecutionResult,
} from "../../Capability/Shared/document-unit-contract.js";
import { runMarkdownDocumentStaticChecks } from "../../Capability/Shared/document-contract-static-checker.js";

export class RequirementContract extends DocumentUnitContract {
  constructor(llmExecutor?: ILlmExecutor) {
    super(llmExecutor);
  }

  protected getContractResourcePath(): string {
    return "contract/RequirementTemplate.contract.json";
  }

  protected getExecutionUnitId(): string {
    return "requirement_design";
  }

  protected collectStaticIssues(
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ) {
    const requirementOutput = output as ExecutionUnitResult<RequirementArtifacts>;
    return runMarkdownDocumentStaticChecks(requirementOutput.artifacts.content.trim(), contractSpec);
  }

  protected skipSemanticFallbackWithoutLlm(): boolean {
    return true;
  }

  protected async buildCheckRequest(
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const requirementOutput = output as ExecutionUnitResult<RequirementArtifacts>;
    const generatedResult = requirementOutput.artifacts.content.trim();

    return {
      prompt: {
        systemPrompt:
          "You check whether a requirement document satisfies the provided contract spec. " +
          "Return JSON with passed, summary, and issues only.",
        userPrompt: {
          target: "requirement_contract_check",
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
        executionUnit: "requirement_design_contract",
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
