import type { FilePath, StageId, TaskId } from "../types/common.js";

export interface WriteArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  filePath: FilePath;
  content: string;
}

export interface GetArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  filePath: FilePath;
}

export interface ListArtifactRequest {
  taskId: TaskId;
  stageId: StageId;
  rootDir: FilePath;
}

export interface IArtifactStore {
  writeArtifact(request: WriteArtifactRequest): Promise<boolean>;
  getArtifact(request: GetArtifactRequest): Promise<string>;
  listArtifacts(query: ListArtifactRequest): Promise<string[]>;
}
