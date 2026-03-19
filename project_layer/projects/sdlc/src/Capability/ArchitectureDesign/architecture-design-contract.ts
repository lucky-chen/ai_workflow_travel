import type {
  ContractCheckResult,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import type { ILlmExecutor, LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../../Capability/Shared/document-unit-contract.js";
import { DocumentUnitContract } from "../../Capability/Shared/document-unit-contract.js";
import { runMarkdownDocumentStaticChecks } from "../../Capability/Shared/document-contract-static-checker.js";

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
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ) {
    const architectureOutput = output as ExecutionUnitResult<ArchitectureArtifacts>;
    return runMarkdownDocumentStaticChecks(architectureOutput.artifacts.content.trim(), contractSpec);
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
}
