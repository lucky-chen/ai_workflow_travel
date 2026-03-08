// Project context loader: scans the workspace and collects relevant project files for prompt input.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ProjectFile } from "../../shared/types/common.js";
import type { ProjectContext } from "./types.js";

export class ProjectContextLoader {
  private static readonly EXCLUDED_DIRECTORIES = new Set([".git", "artifact_store", "dist", "node_modules"]);
  private static readonly MAX_FILE_COUNT = 50;
  private static readonly MAX_FILE_SIZE_BYTES = 64 * 1024;

  async loadProjectContext(context: StageRunContext): Promise<ProjectContext> {
    const relevantFiles = await this.collectProjectFiles(context.workspaceRoot);
    return {
      rootPath: context.workspaceRoot,
      relevantFiles,
    };
  }

  private async collectProjectFiles(workspaceRoot: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    await this.walkDirectory(workspaceRoot, workspaceRoot, files);
    return files;
  }

  private async walkDirectory(
    workspaceRoot: string,
    currentDirectory: string,
    collected: ProjectFile[],
  ): Promise<void> {
    let entries;

    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      if (collected.length >= ProjectContextLoader.MAX_FILE_COUNT) {
        return;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(workspaceRoot, absolutePath);

      if (entry.isDirectory()) {
        if (ProjectContextLoader.EXCLUDED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await this.walkDirectory(workspaceRoot, absolutePath, collected);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = await this.readProjectFile(absolutePath);
      if (content === null) {
        continue;
      }

      collected.push({
        path: relativePath,
        content,
      });
    }
  }

  private async readProjectFile(absolutePath: string): Promise<string | null> {
    const content = await readFile(absolutePath, "utf8");
    if (Buffer.byteLength(content, "utf8") > ProjectContextLoader.MAX_FILE_SIZE_BYTES) {
      return null;
    }

    return content;
  }
}
