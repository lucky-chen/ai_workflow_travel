// Shared change-gate contract: defines review requests and normalized review decisions.
import type { ChangedFile } from "../types/common.js";
import type { ReviewAction, StageId, TaskId } from "../types/common.js";

export interface ChangeReviewRequest {
  taskId: TaskId;
  stageId: StageId;
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
