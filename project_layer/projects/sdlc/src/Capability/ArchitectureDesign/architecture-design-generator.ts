import { getArtifactValue, type ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator } from "../../Capability/Shared/document-unit-generator.js";
import { parseDesignDocumentBreakdown } from "../Shared/design-document-breakdown.js";

export interface ArchitectureDesignArtifacts {
  artifactKey: "architecture_design";
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

export class ArchitectureDesignGenerator extends DocumentUnitGenerator<ArchitectureDesignGeneratorInputPayload> {
  constructor(dependencies: ArchitectureDesignGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<ArchitectureDesignGeneratorInputPayload> {
    const requirementDocument = getArtifactValue(inputArtifacts, "requirement_design");
    if (!requirementDocument) {
      throw new Error('Missing required input artifact "requirement_design".');
    }

    return {
      requirementDocument,
      currentArchitectureDocument: getArtifactValue(inputArtifacts, "architecture_design"),
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/TechnicalArchitectureTemplate.md";
  }

  protected buildPrompt(inputDocument: ArchitectureDesignGeneratorInputPayload, template: string): LlmExecutionRequest {
    const executionUnit = this.readRequestedExecutionUnit("architecture_design_generate");
    const includeCurrentArchitectureDocument = executionUnit === "architecture_design_update";
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
          ...(includeCurrentArchitectureDocument && inputDocument.currentArchitectureDocument
            ? { currentArchitectureDocument: inputDocument.currentArchitectureDocument }
            : {}),
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        executionUnit,
      },
    };
  }

  protected async buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult<ArchitectureDesignArtifacts>> {
    const designDocumentBreakdown = parseDesignDocumentBreakdown(result.content);
    const executionUnit = this.readRequestedExecutionUnit("architecture_design_generate");
    const isUpdate = executionUnit === "architecture_design_update";
    return {
      executionUnitId: "architecture_design",
      success: true,
      summary: isUpdate ? "Architecture design document updated." : "Architecture design document generated.",
      artifacts: {
        artifactKey: "architecture_design",
        content: result.content,
        design_document_breakdown: JSON.stringify(designDocumentBreakdown),
      },
    };
  }

  protected buildGenerationFinishedPayload(output: ExecutionUnitResult): Record<string, unknown> | undefined {
    const artifacts = output.artifacts as Partial<ArchitectureDesignArtifacts>;
    if (typeof artifacts.design_document_breakdown !== "string") {
      return undefined;
    }

    return {
      designDocumentBreakdown: JSON.parse(artifacts.design_document_breakdown) as unknown,
    };
  }
}
