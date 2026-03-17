import { getArtifactValue, type ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator } from "../../Capability/Shared/document-unit-generator.js";

export interface WorkPlanArtifacts {
  artifactKey: "work_plan";
  content: string;
}

export interface WorkPlanGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

interface WorkPlanGeneratorInputPayload {
  requirementDocument: string;
  architectureDocument: string;
  itemDesignDocuments: string[];
  sharedCollaborationStandardPath: string;
}

export class WorkPlanGenerator extends DocumentUnitGenerator<WorkPlanGeneratorInputPayload> {
  constructor(dependencies: WorkPlanGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<WorkPlanGeneratorInputPayload> {
    const requirementDocument = getArtifactValue(inputArtifacts, "requirement_design");
    if (!requirementDocument) {
      throw new Error('Missing required input artifact "requirement_design".');
    }

    const architectureDocument = getArtifactValue(inputArtifacts, "architecture_design");
    if (!architectureDocument) {
      throw new Error('Missing required input artifact "architecture_design".');
    }

    const rawItemDesignDocuments = getArtifactValue(inputArtifacts, "item_design_documents");
    if (!rawItemDesignDocuments) {
      throw new Error('Missing required input artifact "item_design_documents".');
    }

    let itemDesignDocuments: unknown;
    try {
      itemDesignDocuments = JSON.parse(rawItemDesignDocuments);
    } catch {
      throw new Error('Input artifact "item_design_documents" must be valid JSON.');
    }

    if (!Array.isArray(itemDesignDocuments)
      || itemDesignDocuments.length === 0
      || itemDesignDocuments.some((entry) => typeof entry !== "string" || entry.length === 0)) {
      throw new Error('Input artifact "item_design_documents" must contain a non-empty string array.');
    }

    return {
      requirementDocument,
      architectureDocument,
      itemDesignDocuments,
      sharedCollaborationStandardPath: "meta_layer/resources/COLLABORATION_STANDARD.md",
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/CodeGenerationExecutionPlanTemplate.md";
  }

  protected buildPrompt(inputDocument: WorkPlanGeneratorInputPayload, template: string): LlmExecutionRequest {
    const executionUnit = this.readRequestedExecutionUnit("work_plan_generate");
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
          itemDesignDocuments: inputDocument.itemDesignDocuments,
          sharedCollaborationStandardPath: inputDocument.sharedCollaborationStandardPath,
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        executionUnit: "work_plan_generate",
      },
    };
  }

  protected async buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult<WorkPlanArtifacts>> {
    const executionUnit = this.readRequestedExecutionUnit("work_plan_generate");
    const isUpdate = executionUnit === "work_plan_update";
    return {
      executionUnitId: "work_plan",
      success: true,
      summary: isUpdate ? "Work plan updated." : "Work plan generated.",
      artifacts: {
        artifactKey: "work_plan",
        content: result.content,
      },
    };
  }

}
