export class InMemoryChangeGate {
    decision;
    lastRequest;
    constructor(dependencies = {}) {
        this.decision = dependencies.decision ?? {
            action: "apply",
            summary: "Change approved by default gate policy.",
        };
    }
    async review(changeRequest) {
        this.lastRequest = changeRequest;
        return this.decision;
    }
    getLastRequest() {
        return this.lastRequest;
    }
}
export class ChangeReviewPresenter {
    present(reviewId, changeRequest) {
        return {
            reviewId,
            summary: changeRequest.summary,
            changedFiles: changeRequest.changedFiles,
        };
    }
}
export class InteractiveChangeGate {
    reviewInteraction;
    reviewPresenter;
    reviewCounter = 0;
    constructor(reviewInteraction, reviewPresenter = new ChangeReviewPresenter()) {
        this.reviewInteraction = reviewInteraction;
        this.reviewPresenter = reviewPresenter;
    }
    async review(changeRequest) {
        this.reviewCounter += 1;
        const reviewSession = this.reviewPresenter.present(`review-${this.reviewCounter}`, changeRequest);
        return this.reviewInteraction.waitForReview(reviewSession);
    }
}
