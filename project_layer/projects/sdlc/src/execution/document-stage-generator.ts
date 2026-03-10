import type { IStageGenerator, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ITraceRecorder } from "../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../shared/contracts/pipeline.js";
import { resolveResourcePath } from "../shared/resources/resource-resolver.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import type { ArtifactMap } from "../shared/types/common.js";
import { readFile } from "node:fs/promises";

export abstract class DocumentStageGenerator implements IStageGenerator {
  constructor(
    private readonly llmExecutor: ILlmExecutor,
    private readonly traceRecorder?: ITraceRecorder,
  ) {}

  async run(context: StageRunContext): Promise<StageOutput> {
    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.run`,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.generationStarted,
      summary: `Generation started for stage "${context.stageId}".`,
    });

    const inputDocument = await this.loadInputDocument(context.inputArtifacts);
    const template = await this.loadTemplate(context);
    const request = this.buildPrompt(inputDocument, template);
    const result = await this.executeGeneration(request);
    const output = await this.buildStageOutput(result);

    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.run`,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.generationFinished,
      summary: output.summary,
      payload: this.buildGenerationFinishedPayload(output),
    });

    return output;
  }

  protected abstract loadInputDocument(inputArtifacts: ArtifactMap): Promise<string>;
  protected async loadTemplate(context: StageRunContext): Promise<string> {
    const templatePath = await resolveResourcePath(this.getTemplateResourcePath(), context.workspaceRoot);
    return readFile(templatePath, "utf8");
  }
  protected abstract getTemplateResourcePath(): string;
  protected abstract buildPrompt(inputDocument: string, template: string): LlmExecutionRequest;
  protected buildGenerationFinishedPayload(_output: StageOutput): Record<string, unknown> | undefined {
    return undefined;
  }

  protected async executeGeneration(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return this.llmExecutor.execute(request);
  }

  protected abstract buildStageOutput(result: LlmExecutionResult): Promise<StageOutput>;
}
