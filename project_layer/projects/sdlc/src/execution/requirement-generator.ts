import type { StageOutput } from "../shared/contracts/pipeline.js";
import type { ITraceRecorder, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "./document-stage-generator.js";

export interface RequirementArtifacts {
  artifactKey: "requirement_document";
  content: string;
}

export interface RequirementGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export class RequirementGenerator extends DocumentStageGenerator<string> {
  constructor(dependencies: RequirementGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<string> {
    const inputDocument = inputArtifacts.requirement_document;
    if (!inputDocument) {
      throw new Error('Missing required input artifact "requirement_document".');
    }

    return inputDocument;
  }

  protected getTemplateResourcePath(): string {
    return "template/RequirementTemplate.md";
  }

  protected buildPrompt(inputDocument: string, template: string): LlmExecutionRequest {
    const executionUnit = this.readExecutionUnit(this.currentContext);
    return {
      prompt: {
        systemPrompt: [
          "You are a senior product and technical planning expert.",
          "You generate a requirement document that follows the provided template structure.",
          "Treat template comments and contracts as authoring instructions only, not output content.",
          "Return plain markdown only.",
        ],
        userPrompt: {
          target: executionUnit,
          inputDocument,
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        stage: "requirement_interpretation",
      },
    };
  }

  protected async buildStageOutput(result: LlmExecutionResult): Promise<StageOutput<RequirementArtifacts>> {
    const executionUnit = this.readExecutionUnit(this.currentContext);
    const isUpdate = executionUnit === "requirement_design_update";
    return {
      stageId: "requirement_interpretation",
      success: true,
      summary: isUpdate ? "Requirement document updated." : "Requirement document generated.",
      artifacts: {
        artifactKey: "requirement_document",
        content: result.content,
      },
    };
  }

  private currentContext?: StageRunContext;

  async run(context: StageRunContext): Promise<StageOutput> {
    this.currentContext = context;
    try {
      return await super.run(context);
    } finally {
      this.currentContext = undefined;
    }
  }

  private readExecutionUnit(context?: StageRunContext): string {
    const executionUnit = context?.params?.executionUnit?.trim();
    if (executionUnit) {
      return executionUnit;
    }

    return "requirement_design_generate";
  }
}
