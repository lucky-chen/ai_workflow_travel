import path from "node:path";
import type { IExecutionUnitGenerator, ExecutionUnitResult, ExecutionContext } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import { TRACE_EVENT_TYPES } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import { readFile } from "node:fs/promises";
import { getTemplateFilePath } from "./resource-paths.js";

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
      const template = await this.loadTemplate(context);
      const request = this.buildPrompt(inputDocument, template);
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
  protected abstract buildPrompt(inputDocument: TInput, template: string): LlmExecutionRequest;
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
