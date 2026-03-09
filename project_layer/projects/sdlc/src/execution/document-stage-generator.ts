import type { IStageGenerator, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ITraceRecorder } from "../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../shared/contracts/pipeline.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import type { ArtifactMap } from "../shared/types/common.js";

export abstract class DocumentStageGenerator implements IStageGenerator {
  constructor(
    private readonly llmExecutor: ILlmExecutor,
    private readonly traceRecorder?: ITraceRecorder,
  ) {}

  async run(context: StageRunContext): Promise<StageOutput> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.generationStarted,
      summary: `Generation started for stage "${context.stageId}".`,
    });

    const inputDocument = await this.loadInputDocument(context.inputArtifacts);
    const template = await this.loadTemplate();
    const request = this.buildPrompt(inputDocument, template);
    const result = await this.executeGeneration(request);
    const output = await this.buildStageOutput(result);

    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.generationFinished,
      summary: output.summary,
    });

    return output;
  }

  protected abstract loadInputDocument(inputArtifacts: ArtifactMap): Promise<string>;
  protected abstract loadTemplate(): Promise<string>;
  protected abstract buildPrompt(inputDocument: string, template: string): LlmExecutionRequest;

  protected async executeGeneration(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return this.llmExecutor.execute(request);
  }

  protected abstract buildStageOutput(result: LlmExecutionResult): Promise<StageOutput>;
}
