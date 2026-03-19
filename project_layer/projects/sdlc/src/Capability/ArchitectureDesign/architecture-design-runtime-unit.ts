import { ArchitectureDesignContract } from "./architecture-design-contract.js";
import { ArchitectureDesignGenerator } from "./architecture-design-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
const ARCHITECTURE_BREAKDOWN_PATH = "sdlc/docs/architecture_design_breakdown.json";
const ARCHITECTURE_CONTRACT_RESULT_PATH = "architecture_design_contract_result.json";
const ARCHITECTURE_UPDATE_RESULT_PATH = "architecture_design_update_result.json";

abstract class ArchitectureDesignRuntimeUnitBase extends RuntimeUnitBase {
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
    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const output = await new ArchitectureDesignGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    await this.writeWorkspaceFile(
      context.workspaceRoot,
      ARCHITECTURE_DOCUMENT_PATH,
      this.readStringField(artifacts, "content"),
    );
    const designDocumentBreakdown = this.readOptionalStringField(artifacts, "design_document_breakdown");
    if (designDocumentBreakdown) {
      await this.writeWorkspaceFile(context.workspaceRoot, ARCHITECTURE_BREAKDOWN_PATH, designDocumentBreakdown);
    }
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${ARCHITECTURE_DOCUMENT_PATH}.`,
    };
  }
}

export class ArchitectureDesignGenerateRuntimeUnit extends ArchitectureDesignRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    return this.runGenerator(request, context, {
      requirement_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
    });
  }
}

export class ArchitectureDesignUpdateRuntimeUnit extends ArchitectureDesignRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const executionContext = this.buildExecutionContext(request, context, {
      requirement_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      ...(await this.readOptionalWorkspaceFile(context.workspaceRoot, ARCHITECTURE_DOCUMENT_PATH, "architecture_design")),
    });
    const output = await new ArchitectureDesignGenerator({
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
      ARCHITECTURE_UPDATE_RESULT_PATH,
      JSON.stringify({ prompt, action: externalAction }, null, 2),
    );
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${ARCHITECTURE_UPDATE_RESULT_PATH}.`,
      externalAction,
    };
  }
}

export class ArchitectureDesignContractRuntimeUnit extends ArchitectureDesignRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const output = {
      executionUnitId: "architecture_design",
      success: true,
      summary: "Loaded architecture design artifact for contract check.",
      artifacts: {
        artifactKey: "architecture_design",
        content: await this.readRequiredWorkspaceFile(context.workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      },
    };
    const executionContext = this.buildExecutionContext(request, context, {});
    const result = await new ArchitectureDesignContract(this.llmExecutor).check(executionContext, output);
    await this.writeArtifact(executionContext, ARCHITECTURE_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
    return {
      accepted: true,
      summary: `${result.summary} Persisted to ${ARCHITECTURE_CONTRACT_RESULT_PATH}.`,
    };
  }
}
