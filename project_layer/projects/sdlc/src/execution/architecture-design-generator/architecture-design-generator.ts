import type { StageOutput } from "../../shared/contracts/pipeline.js";
import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "../document-stage-generator.js";
import { parseDesignDocumentBreakdown } from "../../shared/architecture/design-document-breakdown.js";

export interface ArchitectureDesignArtifacts {
  artifactKey: "architecture_document";
  content: string;
  design_document_breakdown: string;
}

export interface ArchitectureDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export class ArchitectureDesignGenerator extends DocumentStageGenerator {
  constructor(dependencies: ArchitectureDesignGeneratorDependencies) {
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
    return "template/TechnicalArchitectureTemplate.md";
  }

  protected buildPrompt(inputDocument: string, template: string): LlmExecutionRequest {
    return {
      prompt: {
        systemPrompt: [
          "You are a top-tier Senior Technical Architect with deep expertise and years of experience in full-stack architecture.",
          "You generate a technical architecture document that follows the provided template structure.",
          "When creating architecture documents, you must adhere to the document_contracts requirements found in the JSON header comment of the template file",
          "hen drafting chapter content, ensure compliance with the requirements defined in the comments beneath each respective chapter. These comments follow JSON format and must be contained within the section_contract field.",
          "Return plain markdown only.",
        ],
        userPrompt: {
          target: "architecture_design",
          inputDocument,
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        stage: "architecture_design",
      },
    };
  }

  protected async buildStageOutput(result: LlmExecutionResult): Promise<StageOutput<ArchitectureDesignArtifacts>> {
    const designDocumentBreakdown = parseDesignDocumentBreakdown(result.content);
    return {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture design document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: result.content,
        design_document_breakdown: JSON.stringify(designDocumentBreakdown),
      },
    };
  }

  protected buildGenerationFinishedPayload(output: StageOutput): Record<string, unknown> | undefined {
    const artifacts = output.artifacts as Partial<ArchitectureDesignArtifacts>;
    if (typeof artifacts.design_document_breakdown !== "string") {
      return undefined;
    }

    return {
      designDocumentBreakdown: JSON.parse(artifacts.design_document_breakdown) as unknown,
    };
  }
}
