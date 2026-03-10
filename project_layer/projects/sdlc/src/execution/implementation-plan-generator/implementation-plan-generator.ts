import type { StageOutput } from "../../shared/contracts/pipeline.js";
import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "../document-stage-generator.js";

export interface ImplementationPlanArtifacts {
  artifactKey: "implementation_workplan";
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
}

export class ImplementationPlanGenerator extends DocumentStageGenerator {
  constructor(dependencies: ImplementationPlanGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<string> {
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

    const payload: ImplementationPlanGeneratorInputPayload = {
      requirementDocument,
      architectureDocument,
      moduleDesignDocuments,
    };

    return JSON.stringify(payload);
  }

  protected getTemplateResourcePath(): string {
    return "template/CodeGenerationExecutionPlanTemplate.md";
  }

  protected buildPrompt(inputDocument: string, template: string): LlmExecutionRequest {
    const payload = JSON.parse(inputDocument) as ImplementationPlanGeneratorInputPayload;

    return {
      prompt: {
        systemPrompt:
          "You generate an implementation workplan that follows the provided execution-plan template structure. " +
          "Return plain markdown only.",
        userPrompt: {
          target: "implementation_plan",
          requirementDocument: payload.requirementDocument,
          architectureDocument: payload.architectureDocument,
          moduleDesignDocuments: JSON.stringify(payload.moduleDesignDocuments),
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
    return {
      stageId: "implementation_plan",
      success: true,
      summary: "Implementation workplan generated.",
      artifacts: {
        artifactKey: "implementation_workplan",
        content: result.content,
      },
    };
  }
}
