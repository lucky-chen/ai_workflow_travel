import type { StageOutput } from "../../shared/contracts/pipeline.js";
import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "../document-stage-generator.js";

export interface ModuleDescriptor {
  name: string;
  responsibilities: string[];
}

export interface ModuleDesignArtifacts {
  artifactKey: "module_design_document";
  moduleName: string;
  content: string;
}

export interface ModuleDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

interface ModuleDesignGeneratorInputPayload {
  architectureDocument: string;
  moduleDescriptor: ModuleDescriptor;
}

export class ModuleDesignGenerator extends DocumentStageGenerator {
  constructor(dependencies: ModuleDesignGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<string> {
    const architectureDocument = inputArtifacts.architecture_document;
    if (!architectureDocument) {
      throw new Error('Missing required input artifact "architecture_document".');
    }

    const rawModuleDescriptor = inputArtifacts.module_descriptors;
    if (!rawModuleDescriptor) {
      throw new Error('Missing required input artifact "module_descriptors".');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawModuleDescriptor);
    } catch {
      throw new Error('Input artifact "module_descriptors" must be valid JSON.');
    }

    if (!this.isModuleDescriptor(parsed)) {
      throw new Error('Input artifact "module_descriptors" must contain exactly one valid ModuleDescriptor.');
    }

    const payload: ModuleDesignGeneratorInputPayload = {
      architectureDocument,
      moduleDescriptor: parsed,
    };

    return JSON.stringify(payload);
  }

  protected getTemplateResourcePath(): string {
    return "template/ModuleDesignTemplate.md";
  }

  protected buildPrompt(inputDocument: string, template: string): LlmExecutionRequest {
    const payload = JSON.parse(inputDocument) as ModuleDesignGeneratorInputPayload;

    return {
      prompt: {
        systemPrompt:
          "You generate a module design document that follows the provided template structure. " +
          "Return plain markdown only.",
        userPrompt: {
          target: "module_design",
          architectureDocument: payload.architectureDocument,
          moduleDescriptor: JSON.stringify(payload.moduleDescriptor),
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        stage: "module_design",
        moduleName: payload.moduleDescriptor.name,
      },
    };
  }

  protected async buildStageOutput(result: LlmExecutionResult): Promise<StageOutput<ModuleDesignArtifacts>> {
    const moduleName = result.metadata?.moduleName;
    if (!moduleName) {
      throw new Error('Module design generation result must include metadata.moduleName.');
    }

    return {
      stageId: "module_design",
      success: true,
      summary: `Module design document generated for "${moduleName}".`,
      artifacts: {
        artifactKey: "module_design_document",
        moduleName,
        content: result.content,
      },
    };
  }

  private isModuleDescriptor(value: unknown): value is ModuleDescriptor {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return typeof candidate.name === "string"
      && candidate.name.length > 0
      && Array.isArray(candidate.responsibilities)
      && candidate.responsibilities.every((item) => typeof item === "string");
  }
}
