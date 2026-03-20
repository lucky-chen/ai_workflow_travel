import type { IChangeGate } from "../SDK/QualityControl/Gate/change-gate.js";
import type { ChangeReviewRequest, GateDecision } from "../SDK/QualityControl/Gate/change-gate.js";
import { ingestExternalActionResult } from "./external-action-result.js";
import type { ExternalActionResult, RuntimeResult, TaskId, ExecutionUnitId } from "./Schema/runtime.js";

export interface GateContinuationInput {
  taskId: TaskId;
  executionUnitId: ExecutionUnitId;
  summary: string;
  externalActionResult: ExternalActionResult;
}

export async function reviewExternalActionResult(
  changeGate: IChangeGate,
  input: GateContinuationInput,
): Promise<RuntimeResult> {
  const ingestedResult = ingestExternalActionResult(input.externalActionResult);
  const gateDecision = await changeGate.review({
    taskId: input.taskId,
    executionUnitId: input.executionUnitId,
    summary: input.summary,
    changedPaths: ingestedResult.changedFiles?.map((file) => file.path) ?? [],
    changedFiles: ingestedResult.changedFiles ?? [],
  });

  return buildGateContinuationResult(gateDecision, ingestedResult);
}

function buildGateContinuationResult(
  gateDecision: GateDecision,
  ingestedResult: ReturnType<typeof ingestExternalActionResult>,
): RuntimeResult {
  if (gateDecision.action === "reject") {
    return {
      accepted: false,
      summary: gateDecision.summary,
      continuation: {
        branch: "reject",
        targetPath: ingestedResult.targetPath,
        comment: gateDecision.comment,
      },
    };
  }

  if (gateDecision.action === "wait") {
    return {
      accepted: false,
      summary: gateDecision.summary,
      continuation: {
        branch: "wait",
        targetPath: ingestedResult.targetPath,
        resumeInput: ingestedResult.refreshedArtifacts,
        comment: gateDecision.comment,
      },
    };
  }

  return {
    accepted: true,
    summary: gateDecision.summary,
    continuation: {
      branch: "continue",
      targetPath: ingestedResult.targetPath,
      resumeInput: ingestedResult.refreshedArtifacts,
      comment: gateDecision.comment,
    },
  };
}

export function buildExternalChangeReviewRequest(input: GateContinuationInput): ChangeReviewRequest {
  const ingestedResult = ingestExternalActionResult(input.externalActionResult);
  return {
    taskId: input.taskId,
    executionUnitId: input.executionUnitId,
    summary: input.summary,
    changedPaths: ingestedResult.changedFiles?.map((file) => file.path) ?? [],
    changedFiles: ingestedResult.changedFiles ?? [],
  };
}
