// Artifact store module: defines the local persistence entry for stage artifacts.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  GetArtifactRequest,
  IArtifactStore,
  ListArtifactRequest,
  WriteArtifactRequest,
} from "../../shared/contracts/artifact-store.js";
import type { FilePath } from "../../shared/types/common.js";

export class ArtifactStoreService implements IArtifactStore {
  // Storage layout: {storageRoot}/{taskId}/{stageId}/{filePath}
  constructor(private readonly storageRoot: string = path.resolve(process.cwd(), "artifact_store")) {}

  // Public API: persistent artifact entry used by workflow and generators.
  async writeArtifact(request: WriteArtifactRequest): Promise<boolean> {
    const artifactPath = this.getArtifactAbsolutePath(request);
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, request.content, "utf8");
    return true;
  }

  // Public API: artifact read entry used to load upstream stage outputs.
  async getArtifact(request: GetArtifactRequest): Promise<string> {
    const artifactPath = this.getArtifactAbsolutePath(request);
    // Missing files are surfaced as the underlying ENOENT error so callers can decide recovery behavior.
    return readFile(artifactPath, "utf8");
  }

  // Public API: artifact query entry used to inspect stored stage files by directory.
  async listArtifacts(query: ListArtifactRequest): Promise<string[]> {
    const baseDirectory = path.join(this.getStageDirectory(query.taskId, query.stageId), query.rootDir);
    return this.walkRelativePaths(baseDirectory);
  }

  private getArtifactAbsolutePath(request: {
    taskId: string;
    stageId: string;
    filePath: string;
  }): string {
    return path.join(this.getStageDirectory(request.taskId, request.stageId), request.filePath);
  }

  private getStageDirectory(taskId: string, stageId: string): string {
    return path.join(this.storageRoot, taskId, stageId);
  }

  private async walkRelativePaths(directoryPath: string, basePath: string = directoryPath): Promise<FilePath[]> {
    let entries;

    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const collected = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
          return this.walkRelativePaths(absolutePath, basePath);
        }

        return [path.relative(basePath, absolutePath)];
      }),
    );

    return collected.flat().sort();
  }
}
