import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ILlmExecutor } from "../AgentRuntime/LlmExecutor/llm-executor.js";
import type {
  DocumentUpdateActionPayload,
  ExternalAction,
  ExternalActionResult,
} from "../../Runtime/Schema/runtime.js";

export interface ExternalMcpExecutionContext {
  workspaceRoot: string;
}

export interface IExternalMcpAdapter {
  execute(action: ExternalAction, context: ExternalMcpExecutionContext): Promise<ExternalActionResult>;
}

export class ExternalMcpAdapterService implements IExternalMcpAdapter {
  constructor(private readonly llmExecutor: ILlmExecutor) {}

  async execute(action: ExternalAction, context: ExternalMcpExecutionContext): Promise<ExternalActionResult> {
    if (action.tool !== "external_plugin" || action.operation !== "update_markdown") {
      throw new Error(`Unsupported external mcp action: ${action.tool}/${action.operation}`);
    }

    const payload = readDocumentUpdatePayload(action);
    const workspaceFilePath = path.join(context.workspaceRoot, payload.targetArtifact.filePath);
    const currentContent = await readOptionalFile(workspaceFilePath);
    const operation = currentContent === undefined ? "create" : "update";
    const generatedContent = await this.generateUpdatedDocument(payload, currentContent ?? "");

    await mkdir(path.dirname(workspaceFilePath), { recursive: true });
    await writeFile(workspaceFilePath, generatedContent, "utf8");

    return {
      status: "success",
      targetPath: context.workspaceRoot,
      changedFiles: [
        {
          path: payload.targetArtifact.filePath,
          operation,
          content: generatedContent,
        },
      ],
      updatedArtifacts: [
        {
          artifactKey: payload.targetArtifact.artifactKey,
          filePath: payload.targetArtifact.filePath,
          content: generatedContent,
        },
      ],
      resumeInput: {
        [payload.targetArtifact.artifactKey]: generatedContent,
      },
    };
  }

  private async generateUpdatedDocument(
    payload: DocumentUpdateActionPayload,
    currentContent: string,
  ): Promise<string> {
    const result = await this.llmExecutor.execute({
      prompt: {
        systemPrompt: [
          "You are the external MCP document update adapter.",
          "Apply the update instruction to the current document.",
          "Return only the full updated document content.",
        ],
        userPrompt: {
          handoffType: payload.handoffType,
          prompt: payload.prompt,
          targetArtifact: payload.targetArtifact,
          currentDocument: currentContent,
        },
      },
      responseFormat: "text",
      metadata: {
        executionUnit: "external_mcp_adapter",
        adapterOperation: "update_markdown",
      },
    });

    return result.content.trim();
  }
}

function readDocumentUpdatePayload(action: ExternalAction): DocumentUpdateActionPayload {
  const payload = action.payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("Document update adapter requires a document_update payload.");
  }

  const candidate = payload as Partial<DocumentUpdateActionPayload>;
  if (
    candidate.handoffType !== "document_update"
    || typeof candidate.prompt !== "string"
    || typeof candidate.targetArtifact?.artifactKey !== "string"
    || typeof candidate.targetArtifact?.filePath !== "string"
  ) {
    throw new Error("Document update adapter requires a valid document_update payload.");
  }

  return candidate as DocumentUpdateActionPayload;
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}
