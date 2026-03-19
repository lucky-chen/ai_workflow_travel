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

export class ArchitectureDesignRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    private readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    if (request.executionUnitId === "architecture_design_contract") {
      return this.runContract(request, context);
    }

    return this.runGenerate(request, context);
  }

  private async runContract(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
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

  private async runGenerate(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const inputArtifacts = {
      requirement_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      ...(request.executionUnitId === "architecture_design_update"
        ? await this.readOptionalWorkspaceFile(context.workspaceRoot, ARCHITECTURE_DOCUMENT_PATH, "architecture_design")
        : {}),
    };
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
