import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactMap } from "../../Runtime/Schema/runtime.js";
import type { ExecutionContext } from "../../Runtime/Unit/execution-unit.js";
import type { RuntimeContext, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

export abstract class RuntimeUnitBase {
  constructor(
    protected readonly artifactStore: IArtifactStore,
    protected readonly traceRecorder: ITraceRecorder,
    protected readonly resourceRoot?: string,
  ) {}

  protected buildExecutionContext(
    request: UnitRuntimeRequest,
    context: RuntimeContext,
    inputArtifacts: ArtifactMap,
  ): ExecutionContext {
    return {
      taskId: context.runId,
      runId: context.runId,
      executionUnitId: request.executionUnitId,
      attempt: 1,
      workspaceRoot: context.workspaceRoot,
      inputArtifacts,
      params: {
        ...(request.params ?? {}),
        executionUnit: request.executionUnitId,
        ...(this.resourceRoot ? { resourceRoot: this.resourceRoot } : {}),
      },
    };
  }

  protected async writeArtifact(context: ExecutionContext, filePath: string, content: string): Promise<void> {
    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      executionUnitId: context.executionUnitId,
      filePath,
      content,
      workspaceRoot: context.workspaceRoot,
    });
  }

  protected async readStoredArtifact(
    taskId: string,
    executionUnitId: string,
    filePath: string,
    workspaceRoot: string,
  ): Promise<string> {
    return this.artifactStore.getArtifact({
      taskId,
      executionUnitId,
      filePath,
      workspaceRoot,
    });
  }

  protected async readRequiredWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<string> {
    return readFile(path.join(workspaceRoot, relativePath), "utf8");
  }

  protected async readOptionalWorkspaceFile(
    workspaceRoot: string,
    relativePath: string,
    artifactKey: string,
  ): Promise<Record<string, string>> {
    try {
      return {
        [artifactKey]: await this.readRequiredWorkspaceFile(workspaceRoot, relativePath),
      };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  protected async readUserFile(workspaceRoot: string, targetPath: string): Promise<string> {
    const resolvedPath = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(workspaceRoot, targetPath);
    return readFile(resolvedPath, "utf8");
  }

  protected async writeWorkspaceFile(workspaceRoot: string, relativePath: string, content: string): Promise<void> {
    const absolutePath = path.join(workspaceRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  protected parseJsonText<T>(content: string, errorMessage: string): T {
    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(errorMessage);
    }
  }

  protected readStringField(artifacts: Record<string, unknown>, key: string): string {
    const value = artifacts[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Execution unit result is missing required string field "${key}".`);
    }

    return value;
  }

  protected readOptionalStringField(artifacts: Record<string, unknown>, key: string): string | undefined {
    const value = artifacts[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
