import type { IArtifactStore } from "../../data/artifact-store/artifact-store.js";
import type {
  ContractCheckResult,
  IContractChecker,
  IStageRunner,
  StageOutput,
  StageRunContext,
  StageRunnerSharedDependencies,
} from "../../shared/contracts/pipeline.js";
import type { ChangeReviewRequest, GateDecision, IChangeGate } from "../../quality-gate/change-gate/change-gate.js";
import type { ITraceRecorder } from "../../quality-gate/trace/trace-recorder.js";

export interface BaseStageRunnerDependencies extends StageRunnerSharedDependencies {
  changeGate?: IChangeGate;
  artifactStore?: IArtifactStore;
}

export abstract class BaseStageRunner implements IStageRunner {
  protected readonly traceRecorder?: ITraceRecorder;
  protected readonly changeGate?: IChangeGate;
  protected readonly artifactStore?: IArtifactStore;

  constructor(dependencies: BaseStageRunnerDependencies = {}) {
    this.traceRecorder = dependencies.traceRecorder;
    this.changeGate = dependencies.changeGate;
    this.artifactStore = dependencies.artifactStore;
  }

  abstract run(context: StageRunContext): Promise<StageOutput>;

  protected async recordStageStart(context: StageRunContext): Promise<void> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: "stage_started",
      summary: `Stage "${context.stageId}" started.`,
    });
  }

  protected async runContractCheck(
    contractChecker: IContractChecker,
    context: StageRunContext,
    output: StageOutput,
  ): Promise<ContractCheckResult> {
    return contractChecker.check(context, output);
  }

  protected async reviewChanges(changeRequest: ChangeReviewRequest): Promise<GateDecision> {
    const decision: GateDecision = this.changeGate
      ? await this.changeGate.review(changeRequest)
      : {
          action: "apply",
          summary: "No change gate configured. Changes applied by default.",
        };

    await this.traceRecorder?.recordTrace({
      taskId: changeRequest.taskId,
      stageId: changeRequest.stageId,
      eventType: "gate_reviewed",
      summary: decision.summary,
      metadata: {
        action: decision.action,
      },
    });

    return decision;
  }
}
