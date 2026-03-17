import { WorkExecuteContract } from "./work-execute-contract.js";
import { WorkExecuteGenerator } from "./work-execute-generator/work-execute-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

const WORK_EXECUTE_RESULT_PATH = "artifacts/work/work_execute_result.json";
const WORK_EXECUTE_CONTRACT_RESULT_PATH = "artifacts/work/work_execute_contract_result.json";

export class WorkExecuteRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    private readonly llmExecutor: ILlmExecutor,
  ) {
    super(artifactStore, traceRecorder);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    if (request.executionUnitId === "work_execute_contract") {
      const executionContext = this.buildExecutionContext(request, context, {});
      const output = {
        executionUnitId: "work_execute",
        success: true,
        summary: "Loaded work execute artifact for contract check.",
        artifacts: this.parseJsonText(
          await this.readRequiredWorkspaceFile(context.workspaceRoot, WORK_EXECUTE_RESULT_PATH),
          "Stored work execute result must be valid JSON.",
        ),
      };
      const result = await WorkExecuteContract.create().check(executionContext, output);
      await this.writeArtifact(executionContext, WORK_EXECUTE_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
      return {
        accepted: true,
        summary: `${result.summary} Persisted to ${WORK_EXECUTE_CONTRACT_RESULT_PATH}.`,
      };
    }

    const preparedStepContextPath = request.params?.preparedStepContextPath;
    if (!preparedStepContextPath) {
      throw new Error('Missing required option: --prepared-step-context-path');
    }

    const executionContext = this.buildExecutionContext(request, context, {
      prepared_step_context: await this.readUserFile(context.workspaceRoot, preparedStepContextPath),
    });
    const output = await new WorkExecuteGenerator({
      llmExecutor: this.llmExecutor,
    }).run(executionContext);
    await this.writeArtifact(executionContext, WORK_EXECUTE_RESULT_PATH, JSON.stringify(output.artifacts, null, 2));
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${WORK_EXECUTE_RESULT_PATH}.`,
    };
  }
}
