import type { ExternalAction, RuntimeResult } from "../../Runtime/Schema/runtime.js";

export function createDocumentUpdateExternalAction(
  targetPath: string,
  artifactKey: string,
  prompt: string,
): ExternalAction {
  return {
    tool: "external_plugin",
    operation: "update_markdown",
    targetPath,
    payload: {
      handoffType: "document_update",
      prompt,
      targetArtifact: {
        artifactKey,
        filePath: targetPath,
      },
    },
  };
}

export async function persistDocumentUpdateResult(
  writeArtifact: (resultPath: string, content: string) => Promise<void>,
  resultPath: string,
  summary: string,
  externalAction: ExternalAction,
): Promise<RuntimeResult> {
  await writeArtifact(
    resultPath,
    JSON.stringify({ prompt: readPrompt(externalAction), action: externalAction }, null, 2),
  );
  return {
    accepted: true,
    summary: `${summary} Persisted to ${resultPath}.`,
    externalAction,
  };
}

function readPrompt(action: ExternalAction): string {
  const prompt = action.payload && typeof action.payload === "object"
    ? (action.payload as { prompt?: unknown }).prompt
    : undefined;
  if (typeof prompt !== "string") {
    throw new Error("Document update externalAction is missing prompt.");
  }

  return prompt;
}
