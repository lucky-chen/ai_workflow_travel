// Artifact store module: defines the local persistence entry for stage artifacts.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FilePath } from "../../shared/types/common.js";
import type {
  GetArtifactRequest,
  IArtifactStore,
  ITraceRecorder,
  ListArtifactRequest,
  WriteArtifactRequest,
} from "../../shared/contracts/pipeline.js";

export class ArtifactStoreService implements IArtifactStore {
  // Storage layout: {storageRoot}/{taskId}/{stageId}/{filePath}
  constructor(
    private readonly storageRoot: string = path.resolve(process.cwd(), "artifact_store"),
    private readonly traceRecorder?: ITraceRecorder,
  ) {}

  // Public API: persistent artifact entry used by workflow and generators.
  async writeArtifact(request: WriteArtifactRequest): Promise<boolean> {
    const artifactPath = this.getArtifactAbsolutePath(request);
    await this.writeFileAt(artifactPath, request.content);

    if (request.workspaceRoot) {
      const workspaceArtifactPath = path.join(request.workspaceRoot, request.filePath);
      await this.writeFileAt(workspaceArtifactPath, request.content);
    }

    await this.traceRecorder?.recordTrace({
      caller: "ArtifactStoreService.writeArtifact",
      category: "artifact",
      stageId: request.stageId,
      eventType: "artifact_persisted",
      summary: `Artifact persisted to ${request.filePath}.`,
      payload: {
        filePath: request.filePath,
        mirroredToWorkspace: Boolean(request.workspaceRoot),
      },
    });

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

  private async writeFileAt(targetPath: string, content: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
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
