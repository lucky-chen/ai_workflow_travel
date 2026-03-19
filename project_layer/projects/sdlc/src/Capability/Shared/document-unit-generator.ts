import path from "node:path";
import type { IExecutionUnitGenerator, ExecutionUnitResult, ExecutionContext } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import { TRACE_EVENT_TYPES } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import { readFile } from "node:fs/promises";
import { getTemplateFilePath } from "./resource-paths.js";
import { loadContractSpecFromJson } from "./contract-spec-loader.js";
import type { ContractSpec } from "./document-unit-contract.js";

export interface DocumentPromptMaterials {
  template: string;
  contractSpec?: ContractSpec;
}

export abstract class DocumentUnitGenerator<TInput = string> implements IExecutionUnitGenerator {
  private static readonly resourceCache = new Map<string, string>();
  private currentContext?: ExecutionContext;

  constructor(
    private readonly llmExecutor: ILlmExecutor,
    private readonly traceRecorder?: ITraceRecorder,
  ) {}

  async run(context: ExecutionContext): Promise<ExecutionUnitResult> {
    this.currentContext = context;
    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.run`,
      executionUnitId: context.executionUnitId,
      eventType: TRACE_EVENT_TYPES.generationStarted,
      summary: `Generation started for execution unit "${context.executionUnitId}".`,
    });

    try {
      const inputDocument = await this.loadInputDocument(context.inputArtifacts);
      const promptMaterials = await this.loadPromptMaterials(context);
      const request = this.buildPrompt(inputDocument, promptMaterials);
      const result = await this.executeGeneration(request);
      const output = await this.buildExecutionUnitResult(result);

      await this.traceRecorder?.recordTrace({
        caller: `${this.constructor.name}.run`,
        executionUnitId: context.executionUnitId,
        eventType: TRACE_EVENT_TYPES.generationFinished,
        summary: output.summary,
        payload: this.buildGenerationFinishedPayload(output),
      });

      return output;
    } finally {
      this.currentContext = undefined;
    }
  }

  protected abstract loadInputDocument(inputArtifacts: ArtifactMap): Promise<TInput>;
  protected async loadPromptMaterials(context: ExecutionContext): Promise<DocumentPromptMaterials> {
    const template = await this.loadTemplate(context);
    return {
      template,
      contractSpec: await this.loadContractSpec(context),
    };
  }
  protected async loadTemplate(context: ExecutionContext): Promise<string> {
    const templatePath = await getTemplateFilePath(
      context.workspaceRoot,
      path.basename(this.getTemplateResourcePath()),
      context.params?.resourceRoot,
    );
    const cached = DocumentUnitGenerator.resourceCache.get(templatePath);
    if (cached !== undefined) {
      return cached;
    }

    const template = this.sanitizeTemplateForPrompt(await readFile(templatePath, "utf8"));
    DocumentUnitGenerator.resourceCache.set(templatePath, template);
    return template;
  }
  protected abstract getTemplateResourcePath(): string;
  protected async loadContractSpec(context: ExecutionContext): Promise<ContractSpec | undefined> {
    const templateFileName = path.basename(this.getTemplateResourcePath());
    const contractFileName = templateFileName.replace(/\.[^.]+$/, ".contract.json");
    return loadContractSpecFromJson(
      context.workspaceRoot,
      contractFileName,
      context.executionUnitId,
      typeof context.params?.resourceRoot === "string" ? context.params.resourceRoot : undefined,
    );
  }
  protected abstract buildPrompt(inputDocument: TInput, promptMaterials: DocumentPromptMaterials): LlmExecutionRequest;
  protected buildGenerationFinishedPayload(_output: ExecutionUnitResult): Record<string, unknown> | undefined {
    return undefined;
  }

  protected async executeGeneration(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return this.llmExecutor.execute(request);
  }

  protected getCurrentContext(): ExecutionContext | undefined {
    return this.currentContext;
  }

  protected readRequestedExecutionUnit(defaultExecutionUnit: string): string {
    const executionUnit = this.currentContext?.params?.executionUnit?.trim();
    if (executionUnit) {
      return executionUnit;
    }

    return defaultExecutionUnit;
  }

  protected abstract buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult>;

  protected sanitizeTemplateForPrompt(template: string): string {
    return template
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
