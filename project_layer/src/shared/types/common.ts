export type TaskId = string;
export type StageId = string;
export type ArtifactRef = string;
export type FilePath = string;

export interface ProjectFile {
  path: FilePath;
  content: string;
}

export interface ChangedFile {
  path: FilePath;
  operation: "create" | "update" | "delete";
  content?: string;
}
