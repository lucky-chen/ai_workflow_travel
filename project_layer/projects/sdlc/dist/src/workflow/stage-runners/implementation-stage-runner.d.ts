import type { IContractChecker, IStageGenerator, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ImplementationStageArtifacts } from "../../shared/contracts/pipeline.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
export declare class ImplementationStageRunner extends BaseStageRunner {
    private readonly dependencies;
    private readonly changeApplier;
    constructor(dependencies: BaseStageRunnerDependencies & {
        generator: IStageGenerator<StageOutput<ImplementationStageArtifacts>>;
        contractChecker: IContractChecker;
    });
    run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>>;
}
