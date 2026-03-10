import type { StageOutput, TaskRecord, TaskStatus } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, StageId, TaskId } from "../../shared/types/common.js";

export class TaskRuntimeStore {
  private readonly tasks = new Map<TaskId, TaskRecord>();

  createTask(taskId: TaskId, startStageId: StageId, workspaceRoot: string, inputArtifacts: ArtifactMap, runId?: string): void {
    this.tasks.set(taskId, {
      taskId,
      ...(runId ? { runId } : {}),
      startStageId,
      currentStageId: startStageId,
      attempt: 1,
      status: "pending",
      workspaceRoot,
      inputArtifacts,
    });
  }

  updateTask(taskId: TaskId, updates: Partial<Omit<TaskRecord, "taskId">>): void {
    const current = this.tasks.get(taskId);
    if (!current) {
      throw new Error(`Task "${taskId}" is not registered.`);
    }

    this.tasks.set(taskId, {
      ...current,
      ...updates,
    });
  }

  getTaskStatus(taskId: TaskId): TaskStatus | undefined {
    return this.tasks.get(taskId)?.status;
  }

  getTaskRecord(taskId: TaskId): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  getWorkspaceRoot(taskId: TaskId): string | undefined {
    return this.tasks.get(taskId)?.workspaceRoot;
  }

  getLastOutput(taskId: TaskId): StageOutput | undefined {
    return this.tasks.get(taskId)?.lastOutput;
  }
}
