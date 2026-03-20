import { getArtifactValue, type ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ArtifactMap, RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator, type DocumentPromptMaterials } from "../../Capability/Shared/document-unit-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";

export type WorkPlanArtifacts =
  {
    artifactKey: "work_plan";
    content: string;
  };

export interface WorkPlanGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
export const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
export const ITEM_DESIGN_DIRECTORY = "sdlc/docs/item_design";
export const WORK_PLAN_PATH = "sdlc/docs/work_plan.yaml";

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
    return "template/WorkPlanTemplate.yaml";
  }

  protected buildPrompt(inputDocument: WorkPlanGeneratorInputPayload, promptMaterials: DocumentPromptMaterials): LlmExecutionRequest {
    const executionUnit = "work_plan_generate";
    return {
      prompt: {
        systemPrompt:
          "You generate a work plan that follows the provided yaml template structure. " +
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
    return {
      executionUnitId: "work_plan",
      success: true,
      summary: "Work plan generated.",
      artifacts: {
        artifactKey: "work_plan",
        content: result.content,
      },
    };
  }

}

export class WorkPlanGenerateRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  private async loadItemDesignDocuments(workspaceRoot: string): Promise<string[]> {
    const { readdir, readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const directoryPath = path.join(workspaceRoot, ITEM_DESIGN_DIRECTORY);
    const fileNames = await readdir(directoryPath);
    const markdownFiles = fileNames.filter((entry) => entry.endsWith(".md")).sort();

    if (markdownFiles.length === 0) {
      throw new Error(`Missing required item design documents under "${ITEM_DESIGN_DIRECTORY}".`);
    }

    return Promise.all(markdownFiles.map(async (fileName) => readFile(path.join(directoryPath, fileName), "utf8")));
  }

  private async loadWorkPlanInputArtifacts(workspaceRoot: string): Promise<Record<string, string>> {
    return {
      requirement_design: await this.readRequiredWorkspaceFile(workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      architecture_design: await this.readRequiredWorkspaceFile(workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      item_design_documents: JSON.stringify(await this.loadItemDesignDocuments(workspaceRoot)),
    };
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const executionContext = this.buildExecutionContext(request, context, await this.loadWorkPlanInputArtifacts(context.workspaceRoot));
    const output = await new WorkPlanGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    await this.writeWorkspaceFile(context.workspaceRoot, WORK_PLAN_PATH, this.readStringField(artifacts, "content"));
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${WORK_PLAN_PATH}.`,
    };
  }
}
