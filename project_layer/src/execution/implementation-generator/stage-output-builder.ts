// Stage output builder: converts applied implementation changes into the shared stage output shape.
import type { ImplementationStageArtifacts, StageOutput } from "../../shared/contracts/pipeline.js";
import type { ApplyResult } from "./types.js";

export class StageOutputBuilder {
  build(stageId: string, result: ApplyResult): StageOutput<ImplementationStageArtifacts> {
    return {
      stageId,
      success: true,
      summary: result.summary,
      artifacts: {
        changedFiles: result.changedFiles,
        summary: result.summary,
      },
    };
  }
}
