// Change applier: validates and applies generated file changes into the target workspace.
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LlmExecutionResult } from "../../shared/contracts/llm-executor.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ApplyResult, ParsedGenerationResult, ProjectContext } from "./types.js";

export class ChangeApplier {
  async apply(result: LlmExecutionResult, context: ProjectContext): Promise<ApplyResult> {
    const parsed = this.parseResult(result);
    const changedFiles: ChangedFile[] = [];

    for (const file of parsed.changedFiles) {
      await this.applySingleChange(file, context.rootPath);
      changedFiles.push(file);
    }

    return {
      changedFiles,
      summary: parsed.summary,
    };
  }

  private parseResult(result: LlmExecutionResult): ParsedGenerationResult {
    try {
      const parsed = JSON.parse(result.content) as {
        summary?: string;
        changed_files?: Array<{ path: string; operation: ChangedFile["operation"]; content?: string }>;
      };

      return {
        summary: parsed.summary ?? "Implementation changes generated.",
        changedFiles: (parsed.changed_files ?? []).map((file) => ({
          path: file.path,
          operation: file.operation,
          content: file.content,
        })),
      };
    } catch {
      return {
        summary: "Implementation changes generated.",
        changedFiles: [],
      };
    }
  }

  private async applySingleChange(file: ChangedFile, workspaceRoot: string): Promise<void> {
    const targetPath = this.resolveWorkspacePath(workspaceRoot, file.path);

    if (file.operation === "delete") {
      try {
        await unlink(targetPath);
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== "ENOENT") {
          throw error;
        }
      }
      return;
    }

    if (typeof file.content !== "string") {
      throw new Error(`Missing file content for ${file.operation} operation: ${file.path}`);
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.content, "utf8");
  }

  private resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
    const normalizedRoot = path.resolve(workspaceRoot);
    const candidate = path.resolve(normalizedRoot, relativePath);
    const relativeToRoot = path.relative(normalizedRoot, candidate);

    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new Error(`Refusing to write outside workspace root: ${relativePath}`);
    }

    return candidate;
  }
}
