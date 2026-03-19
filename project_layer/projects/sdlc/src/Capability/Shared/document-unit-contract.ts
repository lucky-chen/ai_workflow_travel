import type { ContractCheckResult, IContractChecker, ExecutionUnitResult, ExecutionContext } from "../../Runtime/Unit/execution-unit.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { loadContractSpecFromJson } from "./contract-spec-loader.js";

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

export abstract class DocumentUnitContract implements IContractChecker {
  constructor(private readonly llmExecutor?: ILlmExecutor) {}

  async check(context: ExecutionContext, output: ExecutionUnitResult): Promise<ContractCheckResult> {
    const contractSpec = await this.loadSpecificContract(context);
    const request = await this.buildCheckRequest(context, output, contractSpec);
    const result = await this.executeCheck(request);
    return this.buildContractResult(result);
  }

  protected abstract getContractResourcePath(): string;
  protected abstract getExecutionUnitId(): string;

  protected async refineLoadedContract(baseSpec: ContractSpec): Promise<ContractSpec> {
    return baseSpec;
  }

  protected async loadSpecificContract(context?: ExecutionContext): Promise<ContractSpec> {
    const workspaceRoot = context?.workspaceRoot;
    if (!workspaceRoot) {
      throw new Error("Document contract loading requires workspaceRoot.");
    }

    const contractFileName = this.getContractResourcePath().replace(/^contract\//, "");
    const baseSpec = await loadContractSpecFromJson(
      workspaceRoot,
      contractFileName,
      this.getExecutionUnitId(),
      typeof context.params?.resourceRoot === "string" ? context.params.resourceRoot : undefined,
    );
    return this.refineLoadedContract(baseSpec);
  }

  protected abstract buildCheckRequest(
    context: ExecutionContext,
    output: ExecutionUnitResult,
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
    const parsed = this.parseContractExecutionContent(result.content) as Partial<ContractExecutionResult>;
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

  private parseContractExecutionContent(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      const normalized = content.trim();
      const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      if (fenced?.[1]) {
        return JSON.parse(fenced[1].trim());
      }

      const objectSlice = this.extractFirstJsonObject(normalized);
      if (objectSlice) {
        return JSON.parse(objectSlice);
      }

      return JSON.parse(content);
    }
  }

  private extractFirstJsonObject(content: string): string | null {
    const start = content.indexOf("{");
    if (start < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < content.length; index += 1) {
      const char = content[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
        continue;
      }

      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return content.slice(start, index + 1);
        }
      }
    }

    return null;
  }

  protected abstract buildContractResult(result: ContractExecutionResult): ContractCheckResult;

  protected abstract checkAgainstPromptRequest(
    request: LlmExecutionRequest,
  ): ContractExecutionResult;
}
