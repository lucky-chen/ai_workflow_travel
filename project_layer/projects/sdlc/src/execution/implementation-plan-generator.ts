import type { ITraceRecorder, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "./document-stage-generator.js";

export interface ImplementationPlanArtifacts {
  artifactKey: "work_plan";
  content: string;
}

export interface ImplementationPlanGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

interface ImplementationPlanGeneratorInputPayload {
  requirementDocument: string;
  architectureDocument: string;
  moduleDesignDocuments: string[];
  sharedCollaborationStandardPath: string;
}

export class ImplementationPlanGenerator extends DocumentStageGenerator<ImplementationPlanGeneratorInputPayload> {
  private currentContext?: StageRunContext;

  constructor(dependencies: ImplementationPlanGeneratorDependencies) {
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

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<ImplementationPlanGeneratorInputPayload> {
    const requirementDocument = inputArtifacts.requirement_document;
    if (!requirementDocument) {
      throw new Error('Missing required input artifact "requirement_document".');
    }

    const architectureDocument = inputArtifacts.architecture_document;
    if (!architectureDocument) {
      throw new Error('Missing required input artifact "architecture_document".');
    }

    const rawModuleDesignDocuments = inputArtifacts.module_design_documents;
    if (!rawModuleDesignDocuments) {
      throw new Error('Missing required input artifact "module_design_documents".');
    }

    let moduleDesignDocuments: unknown;
    try {
      moduleDesignDocuments = JSON.parse(rawModuleDesignDocuments);
    } catch {
      throw new Error('Input artifact "module_design_documents" must be valid JSON.');
    }

    if (!Array.isArray(moduleDesignDocuments)
      || moduleDesignDocuments.length === 0
      || moduleDesignDocuments.some((entry) => typeof entry !== "string" || entry.length === 0)) {
      throw new Error('Input artifact "module_design_documents" must contain a non-empty string array.');
    }

    return {
      requirementDocument,
      architectureDocument,
      moduleDesignDocuments,
      sharedCollaborationStandardPath: "meta_layer/resources/COLLABORATION_STANDARD.md",
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/CodeGenerationExecutionPlanTemplate.md";
  }

  protected buildPrompt(inputDocument: ImplementationPlanGeneratorInputPayload, template: string): LlmExecutionRequest {
    const executionUnit = this.readExecutionUnit(this.currentContext);
    return {
      prompt: {
        systemPrompt:
          "You generate a work plan that follows the provided execution-plan template structure. " +
          "In section 1.1 Collaboration Rule, cite the provided shared collaboration standard document path exactly and keep the fixed scope statement from the template. " +
          "Return plain markdown only.",
        userPrompt: {
          target: executionUnit,
          requirementDocument: inputDocument.requirementDocument,
          architectureDocument: inputDocument.architectureDocument,
          moduleDesignDocuments: inputDocument.moduleDesignDocuments,
          sharedCollaborationStandardPath: inputDocument.sharedCollaborationStandardPath,
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        stage: "implementation_plan",
      },
    };
  }

  protected async buildStageOutput(result: LlmExecutionResult): Promise<StageOutput<ImplementationPlanArtifacts>> {
    const executionUnit = this.readExecutionUnit(this.currentContext);
    const isUpdate = executionUnit === "work_plan_update";
    return {
      stageId: "implementation_plan",
      success: true,
      summary: isUpdate ? "Work plan updated." : "Work plan generated.",
      artifacts: {
        artifactKey: "work_plan",
        content: result.content,
      },
    };
  }

  private readExecutionUnit(context?: StageRunContext): string {
    const executionUnit = context?.params?.executionUnit?.trim();
    if (executionUnit) {
      return executionUnit;
    }

    return "work_plan_generate";
  }
}
