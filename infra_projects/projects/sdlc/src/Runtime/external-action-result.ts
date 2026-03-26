import type { ArtifactMap, ExternalActionResult } from "./Schema/runtime.js";

export interface IngestedExternalActionResult {
  status: ExternalActionResult["status"];
  targetPath: string;
  changedFiles: ExternalActionResult["changedFiles"];
  refreshedArtifacts: ArtifactMap;
  payload: ExternalActionResult["payload"];
  diagnostics: ExternalActionResult["diagnostics"];
}

export function ingestExternalActionResult(result: ExternalActionResult): IngestedExternalActionResult {
  return {
    status: result.status,
    targetPath: result.targetPath,
    changedFiles: result.changedFiles,
    refreshedArtifacts: buildRefreshedArtifacts(result),
    payload: result.payload,
    diagnostics: result.diagnostics,
  };
}

function buildRefreshedArtifacts(result: ExternalActionResult): ArtifactMap {
  if (result.resumeInput) {
    return result.resumeInput;
  }

  if (!result.updatedArtifacts || result.updatedArtifacts.length === 0) {
    return {};
  }

  return Object.fromEntries(
    result.updatedArtifacts.map((artifact) => [
      artifact.artifactKey,
      artifact.content ?? artifact.filePath,
    ]),
  );
}
