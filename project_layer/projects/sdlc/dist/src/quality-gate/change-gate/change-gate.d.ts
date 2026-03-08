import type { IReviewInteraction, ReviewSession } from "../../interface/cli/cli.js";
import type { ChangeReviewRequest, GateDecision, IChangeGate } from "../../shared/contracts/pipeline.js";
export interface InMemoryChangeGateDependencies {
    decision?: GateDecision;
}
export declare class InMemoryChangeGate implements IChangeGate {
    private readonly decision;
    private lastRequest?;
    constructor(dependencies?: InMemoryChangeGateDependencies);
    review(changeRequest: ChangeReviewRequest): Promise<GateDecision>;
    getLastRequest(): ChangeReviewRequest | undefined;
}
export declare class ChangeReviewPresenter {
    present(reviewId: string, changeRequest: ChangeReviewRequest): ReviewSession;
}
export declare class InteractiveChangeGate implements IChangeGate {
    private readonly reviewInteraction;
    private readonly reviewPresenter;
    private reviewCounter;
    constructor(reviewInteraction: IReviewInteraction, reviewPresenter?: ChangeReviewPresenter);
    review(changeRequest: ChangeReviewRequest): Promise<GateDecision>;
}
