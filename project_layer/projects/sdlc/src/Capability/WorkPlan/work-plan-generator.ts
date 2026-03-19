import { getArtifactValue, type ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator, type DocumentPromptMaterials } from "../../Capability/Shared/document-unit-generator.js";

export type WorkPlanArtifacts =
  | {
    artifactKey: "work_plan";
    content: string;
  }
  | {
    artifactKey: "work_plan_update";
    prompt: string;
    targetPath: string;
  };

export interface WorkPlanGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

interface WorkPlanGeneratorInputPayload {
  requirementDocument: string;
  architectureDocument: string;
  itemDesignDocuments: string[];
  sharedCollaborationStandardPath: string;
  currentWorkPlanDocument?: string;
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
      currentWorkPlanDocument: getArtifactValue(inputArtifacts, "work_plan"),
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/WorkPlanTemplate.yaml";
  }

  protected buildPrompt(inputDocument: WorkPlanGeneratorInputPayload, promptMaterials: DocumentPromptMaterials): LlmExecutionRequest {
    const executionUnit = this.readRequestedExecutionUnit("work_plan_generate");
    const isUpdate = executionUnit === "work_plan_update";
    return {
      prompt: {
        systemPrompt:
          isUpdate
            ? "You produce one markdown update instruction for an external plugin to update the current work plan file. " +
              "Use the current work plan as the base document. " +
              "Use the contract rules to identify what must change and what structure must remain aligned. " +
              "Do not output the final updated work plan. " +
              "Return only the update instruction text."
            : "You generate a work plan that follows the provided yaml template structure. " +
              "Use the template as the output skeleton. " +
              "Use the contract rules as the content and format requirements for each section. " +
              "Keep the output as valid yaml using the same top-level keys and the same milestone stage batch task hierarchy shape as the template. " +
              "Cite the provided shared collaboration standard document path exactly when it is needed in the plan content. " +
              "Return plain yaml only.",
        userPrompt: {
          target: executionUnit,
          requirementDocument: inputDocument.requirementDocument,
          architectureDocument: inputDocument.architectureDocument,
          itemDesignDocuments: inputDocument.itemDesignDocuments,
          sharedCollaborationStandardPath: inputDocument.sharedCollaborationStandardPath,
          ...(isUpdate && inputDocument.currentWorkPlanDocument
            ? { currentWorkPlanDocument: inputDocument.currentWorkPlanDocument }
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

  protected async buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult<WorkPlanArtifacts>> {
    const executionUnit = this.readRequestedExecutionUnit("work_plan_generate");
    const isUpdate = executionUnit === "work_plan_update";
    return {
      executionUnitId: "work_plan",
      success: true,
      summary: isUpdate ? "Work plan update prompt generated." : "Work plan generated.",
      artifacts: isUpdate
        ? {
          artifactKey: "work_plan_update",
          prompt: result.content,
          targetPath: "sdlc/docs/work_plan.yaml",
        }
        : {
          artifactKey: "work_plan",
          content: result.content,
        },
    };
  }

}
