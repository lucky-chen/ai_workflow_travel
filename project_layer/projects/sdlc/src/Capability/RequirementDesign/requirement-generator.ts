import type { ExecutionContext, ExecutionUnitResult } from "../../Runtime/Unit/execution-unit.js";
import { getArtifactValue } from "../../Runtime/Unit/execution-unit.js";
import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { DocumentUnitGenerator } from "../../Capability/Shared/document-unit-generator.js";

export interface RequirementArtifacts {
  artifactKey: "requirement_design";
  content: string;
}

export interface RequirementGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

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

  protected buildPrompt(inputDocument: RequirementGeneratorInput, template: string): LlmExecutionRequest {
    const executionUnit = this.readRequestedExecutionUnit("requirement_design_generate");
    return {
      prompt: {
        systemPrompt: [
          "You are a senior product and technical planning expert.",
          "You generate a requirement document that follows the provided template structure.",
          "Treat template comments and contracts as authoring instructions only, not output content.",
          "Return plain markdown only.",
        ],
        userPrompt: {
          target: executionUnit,
          userComment: inputDocument.userComment,
          ...(inputDocument.existingRequirement ? { existingRequirement: inputDocument.existingRequirement } : {}),
          template,
        },
      },
      responseFormat: "text",
      metadata: {
        executionUnit: "requirement_design_generate",
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
      summary: isUpdate ? "Requirement document updated." : "Requirement document generated.",
      artifacts: {
        artifactKey: "requirement_design",
        content: result.content,
      },
    };
  }
}
