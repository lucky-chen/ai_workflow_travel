export interface ChangeReviewRequest {
  summary: string;
  changedPaths: string[];
}

export interface GateDecision {
  action: "apply" | "reject" | "wait";
  summary: string;
  comment?: string;
}

export interface IChangeGate {
  review(changeRequest: ChangeReviewRequest): Promise<GateDecision>;
}
