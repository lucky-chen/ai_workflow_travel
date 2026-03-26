import type { ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import { getArtifactValue, type ExecutionContext } from "../../Runtime/Unit/execution-unit.js";
import type { ArtifactMap, RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import { DocumentUnitGenerator, type DocumentPromptMaterials } from "../../Capability/Shared/document-unit-generator.js";
import { loadContractSpecFromJson } from "../Shared/contract-spec-loader.js";
import { loadItemDesignTemplateSpec } from "./item-design-template-spec.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";

export interface ItemDescriptor {
  name: string;
  responsibilities: string[];
  documentPath?: string;
  description?: string;
}

export type ItemDesignArtifacts =
  {
    artifactKey: "item_design_document";
    moduleName: string;
    documentPath: string;
    content: string;
  };

export interface ItemDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
export const ITEM_DESIGN_DIRECTORY = "sdlc/docs/item_design";

interface ItemDesignGeneratorInputPayload {
  architectureDocument: string;
  itemDescriptor: ItemDescriptor;
}

export class ItemDesignGenerator extends DocumentUnitGenerator<ItemDesignGeneratorInputPayload> {
  constructor(dependencies: ItemDesignGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<ItemDesignGeneratorInputPayload> {
    const architectureDocument = getArtifactValue(inputArtifacts, "architecture_design");
    if (!architectureDocument) {
      throw new Error('Missing required input artifact "architecture_design".');
    }

    const rawItemDescriptor = inputArtifacts.item_descriptors ?? inputArtifacts.module_descriptors;
    if (!rawItemDescriptor) {
      throw new Error('Missing required input artifact "item_descriptors".');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawItemDescriptor);
    } catch {
      throw new Error('Input artifact "item_descriptors" must be valid JSON.');
    }

    if (!this.isItemDescriptor(parsed)) {
      throw new Error('Input artifact "item_descriptors" must contain exactly one valid ItemDescriptor.');
    }

    return {
      architectureDocument,
      itemDescriptor: parsed,
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/ItemDesignTemplate.md";
  }

  protected async loadPromptMaterials(context: ExecutionContext): Promise<DocumentPromptMaterials> {
    const templateSpec = await loadItemDesignTemplateSpec(
      context.workspaceRoot,
      typeof context.params?.resourceRoot === "string" ? context.params.resourceRoot : undefined,
    );
    const contractSpec = await loadContractSpecFromJson(
      context.workspaceRoot,
      "ItemDesignTemplate.contract.json",
      "item_design",
      typeof context.params?.resourceRoot === "string" ? context.params.resourceRoot : undefined,
    );
    return {
      template: templateSpec.outputSkeleton,
      contractSpec,
    };
  }

  protected buildPrompt(inputDocument: ItemDesignGeneratorInputPayload, promptMaterials: DocumentPromptMaterials): LlmExecutionRequest {
    const executionUnit = "item_design_generate";
    return {
      prompt: {
        systemPrompt:
          "You generate an item design document that follows the provided template structure. " +
          "Use the template as the document skeleton. " +
          "Use the contract rules as the chapter content and format requirements. " +
          "Treat template rules as authoring instructions only, not as output content. " +
          "Do not copy template comments, contract schema names, generator internals, or validation internals into the document unless the architecture explicitly defines them. " +
          "Return plain markdown only.",
        userPrompt: {
          target: executionUnit,
          architectureDocument: inputDocument.architectureDocument,
          itemDescriptor: inputDocument.itemDescriptor,
          templateContract: promptMaterials.contractSpec,
          template: promptMaterials.template,
        },
      },
      responseFormat: "text",
      metadata: {
        executionUnit,
        itemName: inputDocument.itemDescriptor.name,
        documentPath: inputDocument.itemDescriptor.documentPath ?? "",
      },
    };
  }

  protected async buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult<ItemDesignArtifacts>> {
    const itemName = result.metadata?.itemName ?? result.metadata?.moduleName;
    if (!itemName) {
      throw new Error('Item design generation result must include metadata.itemName.');
    }
    return {
      executionUnitId: "item_design",
      success: true,
      summary: `Item design document generated for "${itemName}".`,
      artifacts: {
        artifactKey: "item_design_document",
        moduleName: itemName,
        documentPath: result.metadata?.documentPath ?? "",
        content: result.content,
      },
    };
  }

  private isItemDescriptor(value: unknown): value is ItemDescriptor {
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

export class ItemDesignGenerateRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  private async loadItemDescriptor(workspaceRoot: string, request: UnitRuntimeRequest): Promise<ItemDescriptor> {
    if (request.params?.itemDescriptor) {
      return this.parseJsonText<ItemDescriptor>(
        request.params.itemDescriptor,
        'Option "--item-descriptor" must be valid JSON.',
      );
    }

    if (request.params?.itemDescriptorPath) {
      return this.parseJsonText<ItemDescriptor>(
        await this.readUserFile(workspaceRoot, request.params.itemDescriptorPath),
        'Option "--item-descriptor-path" must point to valid JSON.',
      );
    }

    throw new Error('Missing required option: --item-descriptor or --item-descriptor-path');
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const descriptor = await this.loadItemDescriptor(context.workspaceRoot, request);
    const executionContext = this.buildExecutionContext(request, context, {
      architecture_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      item_descriptors: JSON.stringify(descriptor),
    });
    const output = await new ItemDesignGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    const documentPath = this.readOptionalStringField(artifacts, "documentPath")
      ?? `${ITEM_DESIGN_DIRECTORY}/${this.readStringField(artifacts, "moduleName")}.md`;
    await this.writeWorkspaceFile(
      context.workspaceRoot,
      documentPath,
      this.readStringField(artifacts, "content"),
    );
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${documentPath}.`,
    };
  }
}
