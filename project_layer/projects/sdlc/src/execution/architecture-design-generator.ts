import type { ITraceRecorder, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "./document-stage-generator.js";
import { parseDesignDocumentBreakdown } from "../shared/design-document-breakdown.js";

export interface ArchitectureDesignArtifacts {
  artifactKey: "architecture_document";
  content: string;
  design_document_breakdown: string;
}

export interface ArchitectureDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

interface ArchitectureDesignGeneratorInputPayload {
  requirementDocument: string;
  currentArchitectureDocument?: string;
}

export class ArchitectureDesignGenerator extends DocumentStageGenerator<ArchitectureDesignGeneratorInputPayload> {
  private currentContext?: StageRunContext;

  constructor(dependencies: ArchitectureDesignGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  async run(context: StageRunContext): Promise<StageOutput> {
    this.currentContext = context;
    try {
      return await super.run(context);
    } finally {
      this.currentContext = undefined;
    }
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<ArchitectureDesignGeneratorInputPayload> {
    const requirementDocument = inputArtifacts.requirement_document;
    if (!requirementDocument) {
      throw new Error('Missing required input artifact "requirement_document".');
    }

    return {
      requirementDocument,
      currentArchitectureDocument: inputArtifacts.architecture_document,
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/TechnicalArchitectureTemplate.md";
  }

  protected buildPrompt(inputDocument: ArchitectureDesignGeneratorInputPayload, template: string): LlmExecutionRequest {
    const executionUnit = this.readExecutionUnit(this.currentContext);
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
          target: executionUnit,
          requirementDocument: inputDocument.requirementDocument,
          currentArchitectureDocument: inputDocument.currentArchitectureDocument ?? "",
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
    const executionUnit = this.readExecutionUnit(this.currentContext);
    const isUpdate = executionUnit === "architecture_design_update";
    return {
      stageId: "architecture_design",
      success: true,
      summary: isUpdate ? "Architecture design document updated." : "Architecture design document generated.",
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

  private readExecutionUnit(context?: StageRunContext): string {
    const executionUnit = context?.params?.executionUnit?.trim();
    if (executionUnit) {
      return executionUnit;
    }

    return "architecture_design_generate";
  }
}
