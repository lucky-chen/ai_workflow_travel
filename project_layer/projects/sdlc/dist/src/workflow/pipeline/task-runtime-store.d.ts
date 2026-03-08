import type { StageOutput, TaskRecord, TaskStatus } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, StageId, TaskId } from "../../shared/types/common.js";
export declare class TaskRuntimeStore {
    private readonly tasks;
    createTask(taskId: TaskId, startStageId: StageId, workspaceRoot: string, inputArtifacts: ArtifactMap): void;
    updateTask(taskId: TaskId, updates: Partial<Omit<TaskRecord, "taskId">>): void;
    getTaskStatus(taskId: TaskId): TaskStatus | undefined;
    getTaskRecord(taskId: TaskId): TaskRecord | undefined;
    getLastOutput(taskId: TaskId): StageOutput | undefined;
}
