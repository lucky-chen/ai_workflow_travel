import type { StageOutput } from "../shared/contracts/pipeline.js";
import type { ITraceRecorder, StageRunContext } from "../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "./document-stage-generator.js";
import { loadModuleDesignTemplateSpec } from "../shared/module-design-template-spec.js";

export interface ModuleDescriptor {
  name: string;
  responsibilities: string[];
  documentPath?: string;
  description?: string;
}

export interface ModuleDesignArtifacts {
  artifactKey: "item_design_document";
  moduleName: string;
  documentPath: string;
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

export class ModuleDesignGenerator extends DocumentStageGenerator<ModuleDesignGeneratorInputPayload> {
  private currentContext?: StageRunContext;

  constructor(dependencies: ModuleDesignGeneratorDependencies) {
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

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<ModuleDesignGeneratorInputPayload> {
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

    return {
      architectureDocument,
      moduleDescriptor: parsed,
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/ModuleDesignTemplate.md";
  }

  protected async loadTemplate(context: StageRunContext): Promise<string> {
    const spec = await loadModuleDesignTemplateSpec(context.workspaceRoot);
    return JSON.stringify(spec);
  }

  protected buildPrompt(inputDocument: ModuleDesignGeneratorInputPayload, template: string): LlmExecutionRequest {
    const templateSpec = JSON.parse(template) as Awaited<ReturnType<typeof loadModuleDesignTemplateSpec>>;
    const executionUnit = this.readExecutionUnit(this.currentContext);
    return {
      prompt: {
        systemPrompt:
          "You generate an item design document that follows the provided template structure. " +
          "Treat template rules as authoring instructions only, not as output content. " +
          "Do not copy template comments, contract schema names, generator internals, or validation internals into the document unless the architecture explicitly defines them. " +
          "Return plain markdown only.",
        userPrompt: {
          target: executionUnit,
          architectureDocument: inputDocument.architectureDocument,
          moduleDescriptor: inputDocument.moduleDescriptor,
          templateRules: templateSpec.contractSpec,
          templateSkeleton: templateSpec.outputSkeleton,
        },
      },
      responseFormat: "text",
      metadata: {
        stage: "module_design",
        moduleName: inputDocument.moduleDescriptor.name,
        documentPath: inputDocument.moduleDescriptor.documentPath ?? "",
      },
    };
  }

  protected async buildStageOutput(result: LlmExecutionResult): Promise<StageOutput<ModuleDesignArtifacts>> {
    const moduleName = result.metadata?.moduleName;
    if (!moduleName) {
      throw new Error('Item design generation result must include metadata.moduleName.');
    }
    const executionUnit = this.readExecutionUnit(this.currentContext);
    const isUpdate = executionUnit === "item_design_update";
    return {
      stageId: "module_design",
      success: true,
      summary: isUpdate
        ? `Item design document updated for "${moduleName}".`
        : `Item design document generated for "${moduleName}".`,
      artifacts: {
        artifactKey: "item_design_document",
        moduleName,
        documentPath: result.metadata?.documentPath ?? "",
        content: result.content,
      },
    };
  }

  private readExecutionUnit(context?: StageRunContext): string {
    const executionUnit = context?.params?.executionUnit?.trim();
    if (executionUnit) {
      return executionUnit;
    }

    return "item_design_generate";
  }

  private isModuleDescriptor(value: unknown): value is ModuleDescriptor {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return typeof candidate.name === "string"
      && candidate.name.length > 0
      && Array.isArray(candidate.responsibilities)
      && candidate.responsibilities.every((item) => typeof item === "string")
      && (candidate.documentPath === undefined || typeof candidate.documentPath === "string")
      && (candidate.description === undefined || typeof candidate.description === "string");
  }
}
