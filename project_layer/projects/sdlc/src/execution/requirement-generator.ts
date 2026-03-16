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
    return {
      prompt: {
        systemPrompt: [
          "You are a senior product and technical planning expert.",
          "You generate a requirement document that follows the provided template structure.",
          "Treat template comments and contracts as authoring instructions only, not output content.",
          "Return plain markdown only.",
        ],
        userPrompt: {
          target: "requirement_design_generate",
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
    return {
      stageId: "requirement_interpretation",
      success: true,
      summary: "Requirement document generated.",
      artifacts: {
        artifactKey: "requirement_document",
        content: result.content,
      },
    };
  }
}
