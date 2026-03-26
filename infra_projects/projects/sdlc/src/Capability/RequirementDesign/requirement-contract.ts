import type {
  ContractCheckResult,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import { REQUIREMENT_DOCUMENT_PATH, type RequirementArtifacts } from "./requirement-generator.js";
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
    const generatedArtifacts = this.readGeneratedArtifacts(output);
    return runMarkdownDocumentStaticChecks(generatedArtifacts.content.trim(), contractSpec);
  }

  protected skipSemanticFallbackWithoutLlm(): boolean {
    return true;
  }

  protected async buildCheckRequest(
    _context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const generatedResult = this.readGeneratedArtifacts(output).content.trim();

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

  private readGeneratedArtifacts(output: ExecutionUnitResult): Extract<RequirementArtifacts, { artifactKey: "requirement_design" }> {
    const artifacts = (output as ExecutionUnitResult<RequirementArtifacts>).artifacts;
    if (artifacts.artifactKey !== "requirement_design") {
      throw new Error("Requirement contract expects a generated requirement artifact.");
    }

    return artifacts;
  }
}

const REQUIREMENT_CONTRACT_RESULT_PATH = "requirement_design_contract_result.json";

export class RequirementDesignContractRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const output = {
      executionUnitId: "requirement_design",
      success: true,
      summary: "Loaded requirement design artifact for contract check.",
      artifacts: {
        artifactKey: "requirement_design",
        content: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      },
    };
    const executionContext = this.buildExecutionContext(request, context, {});
    const result = await new RequirementContract(this.llmExecutor).check(executionContext, output);
    await this.writeArtifact(executionContext, REQUIREMENT_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
    return {
      accepted: true,
      summary: `${result.summary} Persisted to ${REQUIREMENT_CONTRACT_RESULT_PATH}.`,
    };
  }
}
