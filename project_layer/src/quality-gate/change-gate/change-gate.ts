// Change gate module: returns a stable review decision for change requests.
import type {
  ChangeReviewRequest,
  GateDecision,
  IChangeGate,
} from "../../shared/contracts/change-gate.js";
import type { IReviewInteraction, ReviewSession } from "../../interface/cli/cli.js";

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
