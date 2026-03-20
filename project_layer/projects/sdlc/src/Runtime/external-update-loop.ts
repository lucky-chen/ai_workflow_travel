import type { IChangeGate } from "../SDK/QualityControl/Gate/change-gate.js";
import { reviewExternalActionResult } from "./gate-continuation.js";
import { ingestExternalActionResult } from "./external-action-result.js";
import type {
  DocumentUpdateActionPayload,
  ExternalActionResult,
  RuntimeResult,
  TaskId,
  ExecutionUnitId,
} from "./Schema/runtime.js";

export interface ExternalUpdateLoopInput {
  taskId: TaskId;
  executionUnitId: ExecutionUnitId;
  initialResult: RuntimeResult;
  externalActionResult: ExternalActionResult;
}

export async function continueDocumentUpdateLoop(
  changeGate: IChangeGate,
  input: ExternalUpdateLoopInput,
): Promise<RuntimeResult> {
  const payload = readDocumentUpdatePayload(input.initialResult);
  const ingestedResult = ingestExternalActionResult(input.externalActionResult);
  const targetArtifactValue = ingestedResult.refreshedArtifacts[payload.targetArtifact.artifactKey];

  if (typeof targetArtifactValue !== "string" || targetArtifactValue.trim().length === 0) {
    throw new Error(
      `External update result is missing refreshed artifact "${payload.targetArtifact.artifactKey}" for continuation.`,
    );
  }

  return reviewExternalActionResult(changeGate, {
    taskId: input.taskId,
    executionUnitId: input.executionUnitId,
    summary: `Review external update result for ${payload.targetArtifact.artifactKey}.`,
    externalActionResult: {
      ...input.externalActionResult,
      resumeInput: {
        ...ingestedResult.refreshedArtifacts,
      },
    },
  });
}

function readDocumentUpdatePayload(result: RuntimeResult): DocumentUpdateActionPayload {
  const payload = result.externalAction?.payload;
  if (!isDocumentUpdateActionPayload(payload)) {
    throw new Error("Document update loop requires a document_update external action payload.");
  }

  return payload;
}

function isDocumentUpdateActionPayload(payload: unknown): payload is DocumentUpdateActionPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<DocumentUpdateActionPayload>;
  return candidate.handoffType === "document_update"
    && typeof candidate.prompt === "string"
    && typeof candidate.targetArtifact?.artifactKey === "string"
    && typeof candidate.targetArtifact?.filePath === "string";
}
