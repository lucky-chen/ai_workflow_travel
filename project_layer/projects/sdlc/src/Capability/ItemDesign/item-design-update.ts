import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ItemDescriptor } from "./item-design-generator.js";
import {
  ARCHITECTURE_DOCUMENT_PATH,
} from "./item-design-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";

const ITEM_DESIGN_UPDATE_RESULT_PATH = "item_design_update_result.json";

function buildItemDesignUpdatePrompt(
  architectureDocument: string,
  descriptor: ItemDescriptor,
  currentItemDocument?: string,
): string {
  const normalizedArchitecture = architectureDocument.trim();
  const normalizedCurrentItem = currentItemDocument?.trim() ?? "";
  const sections = [
    `Update the existing item design markdown document for "${descriptor.name}".`,
    "",
    "Architecture document:",
    normalizedArchitecture,
    "",
    "Item descriptor:",
    JSON.stringify(descriptor, null, 2),
  ];

  if (normalizedCurrentItem.length > 0) {
    sections.push(
      "",
      "Current item design document:",
      normalizedCurrentItem,
    );
  }

  sections.push(
    "",
    "Return one markdown-only update instruction for an external editor.",
    "Keep the item design aligned with the architecture document, item descriptor, template structure, and contract requirements.",
    "Do not apply the change directly.",
  );

  return sections.join("\n");
}

export class ItemDesignUpdateRuntimeUnit extends RuntimeUnitBase {
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
    const currentItemArtifacts = descriptor.documentPath
      ? await this.readOptionalWorkspaceFile(context.workspaceRoot, descriptor.documentPath, "item_design_document")
      : {};
    const inputArtifacts: Record<string, string> = {
      architecture_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      item_descriptors: JSON.stringify(descriptor),
      ...currentItemArtifacts,
    };
    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const prompt = buildItemDesignUpdatePrompt(
      inputArtifacts.architecture_design,
      descriptor,
      inputArtifacts.item_design_document,
    );
    const targetPath = descriptor.documentPath ?? "";
    const externalAction = {
      tool: "external_plugin" as const,
      operation: "update_markdown",
      targetPath,
      payload: {
        prompt,
      },
    };
    await this.writeArtifact(
      executionContext,
      ITEM_DESIGN_UPDATE_RESULT_PATH,
      JSON.stringify({ prompt, action: externalAction }, null, 2),
    );
    return {
      accepted: true,
      summary: `Item design update prompt generated for "${descriptor.name}". Persisted to ${ITEM_DESIGN_UPDATE_RESULT_PATH}.`,
      externalAction,
    };
  }
}
