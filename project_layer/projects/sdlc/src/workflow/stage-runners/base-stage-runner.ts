import type {
  ChangeReviewRequest,
  ContractCheckResult,
  GateDecision,
  IArtifactStore,
  IChangeGate,
  IContractChecker,
  IStageRunner,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
  StageRunnerSharedDependencies,
} from "../../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../../shared/contracts/pipeline.js";

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
      eventType: TRACE_EVENT_TYPES.stageStarted,
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

  protected async recordSharedContractResult(context: StageRunContext, passed: boolean, summary: string): Promise<void> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.contractChecked,
      summary,
      metadata: {
        passed: String(passed),
      },
    });
  }

  protected async recordSharedPersistenceResult(
    context: StageRunContext,
    artifactPath: string,
    summary: string,
    gateDecision?: GateDecision,
  ): Promise<void> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.artifactPersisted,
      summary,
      metadata: {
        filePath: artifactPath,
        ...(gateDecision ? { action: gateDecision.action } : {}),
      },
    });
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
      eventType: TRACE_EVENT_TYPES.gateReviewed,
      summary: decision.summary,
      metadata: {
        action: decision.action,
        ...(decision.comment ? { comment: decision.comment } : {}),
      },
    });

    return decision;
  }
}
