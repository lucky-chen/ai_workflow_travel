// Artifact store module: defines the local persistence entry for execution-unit artifacts.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExecutionUnitId, FilePath, TaskId } from "../Runtime/Schema/runtime.js";
import type { ITraceRecorder } from "../SDK/QualityControl/Trace/trace-recorder.js";

export interface WriteArtifactRequest {
  taskId: TaskId;
  executionUnitId: ExecutionUnitId;
  filePath: FilePath;
  content: string;
  workspaceRoot?: string;
}

export interface GetArtifactRequest {
  taskId: TaskId;
  executionUnitId: ExecutionUnitId;
  filePath: FilePath;
  workspaceRoot?: string;
}

export interface ListArtifactRequest {
  taskId: TaskId;
  executionUnitId: ExecutionUnitId;
  rootDir: FilePath;
  workspaceRoot?: string;
}

export interface IArtifactStore {
  writeArtifact(request: WriteArtifactRequest): Promise<boolean>;
  getArtifact(request: GetArtifactRequest): Promise<string>;
  listArtifacts(query: ListArtifactRequest): Promise<string[]>;
}

export class ArtifactStoreService implements IArtifactStore {
  // Storage layout: {storageRoot or workspaceRoot/dist/sdlc/artifact_store}/{taskId}/{executionUnitId}/{filePath}
  constructor(
    private readonly storageRoot?: string,
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
      executionUnitId: request.executionUnitId,
      eventType: "artifact_persisted",
      summary: `Artifact persisted to ${request.filePath}.`,
      payload: {
        filePath: request.filePath,
        mirroredToWorkspace: Boolean(request.workspaceRoot),
      },
    });

    return true;
  }

  // Public API: artifact read entry used to load upstream execution-unit results.
  async getArtifact(request: GetArtifactRequest): Promise<string> {
    const artifactPath = this.getArtifactAbsolutePath(request);
    // Missing files are surfaced as the underlying ENOENT error so callers can decide recovery behavior.
    return readFile(artifactPath, "utf8");
  }

  // Public API: artifact query entry used to inspect stored execution-unit files by directory.
  async listArtifacts(query: ListArtifactRequest): Promise<string[]> {
    const baseDirectory = path.join(this.getExecutionUnitDirectory(query.taskId, query.executionUnitId, query.workspaceRoot), query.rootDir);
    return this.walkRelativePaths(baseDirectory);
  }

  private getArtifactAbsolutePath(request: {
    taskId: string;
    executionUnitId: string;
    filePath: string;
    workspaceRoot?: string;
  }): string {
    return path.join(this.getExecutionUnitDirectory(request.taskId, request.executionUnitId, request.workspaceRoot), request.filePath);
  }

  private getExecutionUnitDirectory(taskId: string, executionUnitId: string, workspaceRoot?: string): string {
    return path.join(this.resolveStorageRoot(workspaceRoot), taskId, executionUnitId);
  }

  private resolveStorageRoot(workspaceRoot?: string): string {
    if (this.storageRoot) {
      return this.storageRoot;
    }

    if (!workspaceRoot?.trim()) {
      throw new Error('Artifact store requires "workspaceRoot" when no explicit storageRoot is configured.');
    }

    return path.resolve(workspaceRoot, "dist", "sdlc", "artifact_store");
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
