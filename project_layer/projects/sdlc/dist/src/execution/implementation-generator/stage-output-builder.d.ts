import type { ImplementationStageArtifacts, StageOutput } from "../../shared/contracts/pipeline.js";
import type { ApplyResult } from "./types.js";
export declare class StageOutputBuilder {
    build(stageId: string, result: ApplyResult): StageOutput<ImplementationStageArtifacts>;
}
