export type TaskId = string;
export type StageId = string;
export type ArtifactRef = string;
export type FilePath = string;
export type TraceRef = string;
export type StringMap = Readonly<Record<string, string>>;
export type ArtifactMap = Readonly<Record<string, ArtifactRef>>;
export type IssueSeverity = "low" | "medium" | "high";
export type ReviewAction = "apply" | "reject" | "wait";
export type ChangeOperation = "create" | "update" | "delete";
export interface ProjectFile {
    path: FilePath;
    content: string;
}
export interface ChangedFile {
    path: FilePath;
    operation: ChangeOperation;
    content?: string;
}
