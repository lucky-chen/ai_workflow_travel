// Execution-unit result builder: converts applied implementation changes into the shared execution-unit result shape.
import type { WorkExecuteArtifacts, ExecutionUnitResult } from "../../../Runtime/Unit/execution-unit.js";
import type { ApplyResult } from "./types.js";

export class ExecutionOutputBuilder {
  build(executionUnitId: string, result: ApplyResult): ExecutionUnitResult<WorkExecuteArtifacts> {
    return {
      executionUnitId,
      success: true,
      summary: result.summary,
      artifacts: {
        changedFiles: result.changedFiles,
        summary: result.summary,
      },
    };
  }
}
