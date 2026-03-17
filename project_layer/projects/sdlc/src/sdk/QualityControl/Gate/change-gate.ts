// Change gate module: returns a stable review decision for change requests.
import type { IReviewInteraction, ReviewSession } from "../../../Interface/CliEntry/cli-types.js";
import type { ChangedFile, ExecutionUnitId, ReviewAction, TaskId } from "../../../Runtime/Schema/runtime.js";

export interface ChangeReviewRequest {
  taskId: TaskId;
  executionUnitId: ExecutionUnitId;
  summary: string;
  changedPaths: string[];
  changedFiles: ChangedFile[];
}

export interface GateDecision {
  action: ReviewAction;
  summary: string;
  comment?: string;
}

export interface IChangeGate {
  review(changeRequest: ChangeReviewRequest): Promise<GateDecision>;
}

export interface InMemoryChangeGateDependencies {
  decision?: GateDecision;
}

export class InMemoryChangeGate implements IChangeGate {
  private readonly decision: GateDecision;
  private lastRequest?: ChangeReviewRequest;

  constructor(dependencies: InMemoryChangeGateDependencies = {}) {
    this.decision = dependencies.decision ?? {
      action: "apply",
      summary: "Change approved by default gate policy.",
    };
  }

  async review(changeRequest: ChangeReviewRequest): Promise<GateDecision> {
    this.lastRequest = changeRequest;
    return this.decision;
  }

  getLastRequest(): ChangeReviewRequest | undefined {
    return this.lastRequest;
  }
}

export class ChangeReviewPresenter {
  present(reviewId: string, changeRequest: ChangeReviewRequest): ReviewSession {
    return {
      reviewId,
      summary: changeRequest.summary,
      changedPaths: changeRequest.changedPaths,
      changedFiles: changeRequest.changedFiles,
    };
  }
}

export class InteractiveChangeGate implements IChangeGate {
  private reviewCounter = 0;

  constructor(
    private readonly reviewInteraction: IReviewInteraction,
    private readonly reviewPresenter: ChangeReviewPresenter = new ChangeReviewPresenter(),
  ) {}

  async review(changeRequest: ChangeReviewRequest): Promise<GateDecision> {
    this.reviewCounter += 1;
    const reviewSession = this.reviewPresenter.present(`review-${this.reviewCounter}`, changeRequest);

    return this.reviewInteraction.waitForReview(reviewSession);
  }
}
