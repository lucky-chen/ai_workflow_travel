import { getArtifactValue, type ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ArtifactMap, RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator, type DocumentPromptMaterials } from "../../Capability/Shared/document-unit-generator.js";
import { parseDesignDocumentBreakdown } from "../Shared/design-document-breakdown.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";

export type ArchitectureDesignArtifacts =
  | {
    artifactKey: "architecture_design";
    content: string;
    design_document_breakdown: string;
  }
  | {
    artifactKey: "architecture_design_update";
    prompt: string;
    targetPath: string;
  };

export interface ArchitectureDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
export const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
export const ARCHITECTURE_BREAKDOWN_PATH = "sdlc/docs/architecture_design_breakdown.json";

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

  protected buildPrompt(
    inputDocument: ArchitectureDesignGeneratorInputPayload,
    promptMaterials: DocumentPromptMaterials,
  ): LlmExecutionRequest {
    const executionUnit = this.readRequestedExecutionUnit("architecture_design_generate");
    const includeCurrentArchitectureDocument = executionUnit === "architecture_design_update";
    const systemPrompt = includeCurrentArchitectureDocument
      ? [
        "You are a top-tier Senior Technical Architect with deep expertise and years of experience in full-stack architecture.",
        "You produce one markdown update instruction for an external plugin to update the current technical architecture document.",
        "Use the current architecture document as the base document.",
        "Use the contract rules to identify what must change and what structure must remain aligned.",
        "Do not output the final updated architecture document.",
        "Return only the update instruction text.",
      ]
      : [
        "You are a top-tier Senior Technical Architect with deep expertise and years of experience in full-stack architecture.",
        "You generate a technical architecture document that follows the provided template structure.",
        "Use the template as the document skeleton.",
        "Use the contract rules as the chapter content and format requirements.",
        "Do not output template comments or contract schema names.",
        "Return plain markdown only.",
      ];
    return {
      prompt: {
        systemPrompt,
        userPrompt: {
          target: executionUnit,
          requirementDocument: inputDocument.requirementDocument,
          ...(includeCurrentArchitectureDocument && inputDocument.currentArchitectureDocument
            ? { currentArchitectureDocument: inputDocument.currentArchitectureDocument }
            : {}),
          template: promptMaterials.template,
          templateContract: promptMaterials.contractSpec,
        },
      },
      responseFormat: "text",
      metadata: {
        executionUnit,
      },
    };
  }

  protected async buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult<ArchitectureDesignArtifacts>> {
    const executionUnit = this.readRequestedExecutionUnit("architecture_design_generate");
    const isUpdate = executionUnit === "architecture_design_update";
    return {
      executionUnitId: "architecture_design",
      success: true,
      summary: isUpdate ? "Architecture update prompt generated." : "Architecture design document generated.",
      artifacts: isUpdate
        ? {
          artifactKey: "architecture_design_update",
          prompt: result.content,
          targetPath: "sdlc/docs/TechnicalArchitecture.md",
        }
        : {
          artifactKey: "architecture_design",
          content: result.content,
          design_document_breakdown: JSON.stringify(parseDesignDocumentBreakdown(result.content)),
        },
    };
  }

  protected buildGenerationFinishedPayload(output: ExecutionUnitResult): Record<string, unknown> | undefined {
    const artifacts = output.artifacts as ArchitectureDesignArtifacts;
    if (artifacts.artifactKey !== "architecture_design") {
      return undefined;
    }

    if (typeof artifacts.design_document_breakdown !== "string") {
      return undefined;
    }

    return {
      designDocumentBreakdown: JSON.parse(artifacts.design_document_breakdown) as unknown,
    };
  }
}

export class ArchitectureDesignGenerateRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const executionContext = this.buildExecutionContext(request, context, {
      requirement_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
    });
    const output = await new ArchitectureDesignGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    await this.writeWorkspaceFile(
      context.workspaceRoot,
      ARCHITECTURE_DOCUMENT_PATH,
      this.readStringField(artifacts, "content"),
    );
    const designDocumentBreakdown = this.readOptionalStringField(artifacts, "design_document_breakdown");
    if (designDocumentBreakdown) {
      await this.writeWorkspaceFile(context.workspaceRoot, ARCHITECTURE_BREAKDOWN_PATH, designDocumentBreakdown);
    }
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${ARCHITECTURE_DOCUMENT_PATH}.`,
    };
  }
}
