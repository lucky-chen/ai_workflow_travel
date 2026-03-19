import type { ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import { getArtifactValue, type ExecutionContext } from "../../Runtime/Unit/execution-unit.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import { DocumentUnitGenerator } from "../../Capability/Shared/document-unit-generator.js";
import { loadContractSpecFromJson } from "../Shared/contract-spec-loader.js";
import { loadItemDesignTemplateSpec } from "./item-design-template-spec.js";

export interface ItemDescriptor {
  name: string;
  responsibilities: string[];
  documentPath?: string;
  description?: string;
}

export interface ItemDesignArtifacts {
  artifactKey: "item_design_document";
  moduleName: string;
  documentPath: string;
  content: string;
}

export interface ItemDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

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

  protected async loadTemplate(context: ExecutionContext): Promise<string> {
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
    return JSON.stringify({
      contractSpec,
      outputSkeleton: templateSpec.outputSkeleton,
    });
  }

  protected buildPrompt(inputDocument: ItemDesignGeneratorInputPayload, template: string): LlmExecutionRequest {
    const templateSpec = JSON.parse(template) as {
      contractSpec: Awaited<ReturnType<typeof loadContractSpecFromJson>>;
      outputSkeleton: string;
    };
    const executionUnit = this.readRequestedExecutionUnit("item_design_generate");
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
          itemDescriptor: inputDocument.itemDescriptor,
          templateRules: templateSpec.contractSpec,
          templateSkeleton: templateSpec.outputSkeleton,
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
    const executionUnit = this.readRequestedExecutionUnit("item_design_generate");
    const isUpdate = executionUnit === "item_design_update";
    return {
      executionUnitId: "item_design",
      success: true,
      summary: isUpdate
        ? `Item design document updated for "${itemName}".`
        : `Item design document generated for "${itemName}".`,
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
