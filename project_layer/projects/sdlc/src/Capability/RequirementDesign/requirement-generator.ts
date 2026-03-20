import type { ExecutionContext, ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import { getArtifactValue } from "../../Runtime/Unit/execution-unit.js";
import type { ArtifactMap, RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator, type DocumentPromptMaterials } from "../../Capability/Shared/document-unit-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";

export type RequirementArtifacts =
  | {
    artifactKey: "requirement_design";
    content: string;
  }
  | {
    artifactKey: "requirement_design_update";
    prompt: string;
    targetPath: string;
  };

export interface RequirementGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";

interface RequirementGeneratorInput {
  existingRequirement?: string;
  userComment: string;
}

export class RequirementGenerator extends DocumentUnitGenerator<RequirementGeneratorInput> {
  constructor(dependencies: RequirementGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<RequirementGeneratorInput> {
    const existingRequirement = getArtifactValue(inputArtifacts, "requirement_design");
    return {
      ...(existingRequirement ? { existingRequirement } : {}),
      userComment: this.readUserComment(this.getCurrentContext()),
    };
  }

  protected getTemplateResourcePath(): string {
    return "template/RequirementTemplate.md";
  }

  protected buildPrompt(inputDocument: RequirementGeneratorInput, promptMaterials: DocumentPromptMaterials): LlmExecutionRequest {
    const executionUnit = this.readRequestedExecutionUnit("requirement_design_generate");
    const includeExistingRequirement = executionUnit === "requirement_design_update";
    const systemPrompt = includeExistingRequirement
      ? [
        "You are a senior product and technical planning expert.",
        "You produce one markdown update instruction for an external plugin to update the current requirement document.",
        "Use the current requirement as the base document.",
        "Use the contract rules to decide what should change and what structure must stay aligned.",
        "Do not output the final updated requirement document.",
        "Return only the update instruction text.",
      ]
      : [
        "You are a senior product and technical planning expert.",
        "You generate a requirement document that follows the provided template structure.",
        "Use the template as the document skeleton.",
        "Use the contract rules as the chapter content and format requirements.",
        "Treat template comments and contract schema as authoring instructions only, not output content.",
        "Return plain markdown only.",
      ];
    return {
      prompt: {
        systemPrompt,
        userPrompt: {
          target: executionUnit,
          userComment: inputDocument.userComment,
          ...(includeExistingRequirement && inputDocument.existingRequirement
            ? { existingRequirement: inputDocument.existingRequirement }
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

  private readUserComment(context?: ExecutionContext): string {
    const userComment = context?.params?.userComment?.trim();
    if (!userComment) {
      throw new Error('Missing required option: --user-comment');
    }

    return userComment;
  }

  protected async buildExecutionUnitResult(result: LlmExecutionResult): Promise<ExecutionUnitResult<RequirementArtifacts>> {
    const executionUnit = this.readRequestedExecutionUnit("requirement_design_generate");
    const isUpdate = executionUnit === "requirement_design_update";
    return {
      executionUnitId: "requirement_design",
      success: true,
      summary: isUpdate ? "Requirement update prompt generated." : "Requirement document generated.",
      artifacts: isUpdate
        ? {
          artifactKey: "requirement_design_update",
          prompt: result.content,
          targetPath: "sdlc/docs/Requirement.md",
        }
        : {
          artifactKey: "requirement_design",
          content: result.content,
        },
    };
  }
}

export class RequirementDesignGenerateRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const userComment = request.params?.userComment?.trim();
    if (!userComment) {
      throw new Error('Missing required option: --user-comment');
    }

    const executionContext = this.buildExecutionContext(request, context, {});
    const output = await new RequirementGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    await this.writeWorkspaceFile(
      context.workspaceRoot,
      REQUIREMENT_DOCUMENT_PATH,
      this.readStringField(artifacts, "content"),
    );
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${REQUIREMENT_DOCUMENT_PATH}.`,
    };
  }
}
