import { RequirementContract } from "./requirement-contract.js";
import { RequirementGenerator } from "./requirement-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
const REQUIREMENT_CONTRACT_RESULT_PATH = "requirement_design_contract_result.json";
const REQUIREMENT_UPDATE_RESULT_PATH = "requirement_design_update_result.json";

abstract class RequirementDesignRuntimeUnitBase extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  protected async runGenerator(
    request: UnitRuntimeRequest,
    context: RuntimeContext,
    inputArtifacts: Record<string, string>,
  ): Promise<RuntimeResult> {
    const userComment = request.params?.userComment?.trim();
    if (!userComment) {
      throw new Error('Missing required option: --user-comment');
    }

    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
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

export class RequirementDesignGenerateRuntimeUnit extends RequirementDesignRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    return this.runGenerator(request, context, {});
  }
}

export class RequirementDesignUpdateRuntimeUnit extends RequirementDesignRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const inputArtifacts = await this.readOptionalWorkspaceFile(
      context.workspaceRoot,
      REQUIREMENT_DOCUMENT_PATH,
      "requirement_design",
    );
    const userComment = request.params?.userComment?.trim();
    if (!userComment) {
      throw new Error('Missing required option: --user-comment');
    }

    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const output = await new RequirementGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    const prompt = this.readStringField(artifacts, "prompt");
    const targetPath = this.readStringField(artifacts, "targetPath");
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
      REQUIREMENT_UPDATE_RESULT_PATH,
      JSON.stringify({ prompt, action: externalAction }, null, 2),
    );
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${REQUIREMENT_UPDATE_RESULT_PATH}.`,
      externalAction,
    };
  }
}

export class RequirementDesignContractRuntimeUnit extends RequirementDesignRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const output = {
      executionUnitId: "requirement_design",
      success: true,
      summary: "Loaded requirement design artifact for contract check.",
      artifacts: {
        artifactKey: "requirement_design",
        content: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      },
    };
    const executionContext = this.buildExecutionContext(request, context, {});
    const result = await new RequirementContract(this.llmExecutor).check(executionContext, output);
    await this.writeArtifact(executionContext, REQUIREMENT_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
    return {
      accepted: true,
      summary: `${result.summary} Persisted to ${REQUIREMENT_CONTRACT_RESULT_PATH}.`,
    };
  }
}
