import { RequirementContract } from "./requirement-contract.js";
import { RequirementGenerator } from "./requirement-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
const REQUIREMENT_CONTRACT_RESULT_PATH = "artifacts/requirement/requirement_design_contract_result.json";

export class RequirementDesignRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    private readonly llmExecutor: ILlmExecutor,
  ) {
    super(artifactStore, traceRecorder);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    if (request.executionUnitId === "requirement_design_contract") {
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
      const result = await new RequirementContract().check(executionContext, output);
      await this.writeArtifact(executionContext, REQUIREMENT_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
      return {
        accepted: true,
        summary: `${result.summary} Persisted to ${REQUIREMENT_CONTRACT_RESULT_PATH}.`,
      };
    }

    const inputArtifacts = {
      requirement_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
    };
    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const output = await new RequirementGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    await this.writeArtifact(
      executionContext,
      REQUIREMENT_DOCUMENT_PATH,
      this.readStringField(artifacts, "content"),
    );
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${REQUIREMENT_DOCUMENT_PATH}.`,
    };
  }
}
