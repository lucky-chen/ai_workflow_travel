import type { ChangeReviewRequest, ContractCheckResult, GateDecision, IArtifactStore, IChangeGate, IContractChecker, IStageRunner, ITraceRecorder, StageOutput, StageRunContext, StageRunnerSharedDependencies } from "../../shared/contracts/pipeline.js";
export interface BaseStageRunnerDependencies extends StageRunnerSharedDependencies {
    changeGate?: IChangeGate;
    artifactStore?: IArtifactStore;
}
export declare abstract class BaseStageRunner implements IStageRunner {
    protected readonly traceRecorder?: ITraceRecorder;
    protected readonly changeGate?: IChangeGate;
    protected readonly artifactStore?: IArtifactStore;
    constructor(dependencies?: BaseStageRunnerDependencies);
    abstract run(context: StageRunContext): Promise<StageOutput>;
    protected recordStageStart(context: StageRunContext): Promise<void>;
    protected runContractCheck(contractChecker: IContractChecker, context: StageRunContext, output: StageOutput): Promise<ContractCheckResult>;
    protected reviewChanges(changeRequest: ChangeReviewRequest): Promise<GateDecision>;
}
