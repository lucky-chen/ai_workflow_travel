// Pipeline module: provides the workflow entry point that will launch stage execution.
import type {
  IPipeline,
  LaunchTaskRequest,
  StageOutput,
  StageRunContext,
  TaskRecord,
  TaskStatus,
} from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, TaskId, StageId } from "../../shared/types/common.js";
import type { ITraceRecorder } from "../../shared/contracts/trace.js";
import { LaunchValidator } from "./launch-validator.js";
import { StageRegistry } from "./stage-registry.js";
import { TaskRuntimeStore } from "./task-runtime-store.js";

export interface PipelineServiceDependencies {
  registry: StageRegistry;
  launchValidator?: LaunchValidator;
  traceRecorder?: ITraceRecorder;
  taskRuntimeStore?: TaskRuntimeStore;
}

// Public API: workflow entry used by CLI or other callers to launch a task.
export class PipelineService implements IPipeline {
  private readonly registry: StageRegistry;
  private readonly launchValidator: LaunchValidator;
  private readonly traceRecorder?: ITraceRecorder;
  private readonly taskRuntimeStore: TaskRuntimeStore;

  constructor(dependencies: PipelineServiceDependencies) {
    this.registry = dependencies.registry;
    this.launchValidator = dependencies.launchValidator ?? new LaunchValidator();
    this.traceRecorder = dependencies.traceRecorder;
    this.taskRuntimeStore = dependencies.taskRuntimeStore ?? new TaskRuntimeStore();
  }

  async launchTask(request: LaunchTaskRequest): Promise<TaskId> {
    const taskId = this.createTaskId();
    this.registry.validate();
    this.launchValidator.validate(request, this.registry);
    this.taskRuntimeStore.createTask(taskId, request.startStageId, request.workspaceRoot);

    this.taskRuntimeStore.updateTask(taskId, {
      status: "running",
    });
    await this.traceRecorder?.recordTrace({
      taskId,
      eventType: "task_started",
      summary: `Task "${taskId}" started at stage "${request.startStageId}".`,
    });

    let currentStageId: StageId | undefined = request.startStageId;
    let currentInputArtifacts: ArtifactMap = request.inputArtifacts;

    while (currentStageId) {
      const stage = this.registry.get(currentStageId);
      const context: StageRunContext = {
        taskId,
        stageId: currentStageId,
        workspaceRoot: request.workspaceRoot,
        inputArtifacts: currentInputArtifacts,
        params: request.params,
      };

      const output = await stage.runner.run(context);
      this.taskRuntimeStore.updateTask(taskId, {
        currentStageId,
        lastOutput: output,
      });

      if (this.resolveStageStatus(output) === "failed") {
        this.taskRuntimeStore.updateTask(taskId, {
          status: "failed",
        });
        await this.traceRecorder?.recordTrace({
          taskId,
          stageId: currentStageId,
          eventType: "stage_failed",
          summary: `Stage "${currentStageId}" failed.`,
        });
        break;
      }

      currentInputArtifacts = this.mergeInputArtifacts(currentInputArtifacts, output);
      currentStageId = stage.nextStageId ?? undefined;
    }

    if (this.getTaskStatus(taskId) === "running") {
      this.taskRuntimeStore.updateTask(taskId, {
        status: "completed",
      });
    }

    await this.traceRecorder?.recordTrace({
      taskId,
      eventType: "task_finished",
      summary: `Task "${taskId}" finished.`,
    });

    return taskId;
  }

  getLastOutput(taskId: TaskId): StageOutput | undefined {
    return this.taskRuntimeStore.getLastOutput(taskId);
  }

  getTaskStatus(taskId: TaskId): TaskStatus | undefined {
    return this.taskRuntimeStore.getTaskStatus(taskId);
  }

  getTaskRecord(taskId: TaskId): TaskRecord | undefined {
    return this.taskRuntimeStore.getTaskRecord(taskId);
  }

  private createTaskId(): TaskId {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private resolveStageStatus(output: StageOutput): "completed" | "failed" {
    if (output.status) {
      return output.status;
    }

    return output.success ? "completed" : "failed";
  }

  private mergeInputArtifacts(current: ArtifactMap, output: StageOutput): ArtifactMap {
    if (!output.artifacts || typeof output.artifacts !== "object") {
      return current;
    }

    const nextEntries = Object.entries(output.artifacts as Record<string, unknown>).filter(
      (_entry): _entry is [string, string] => typeof _entry[1] === "string",
    );

    if (nextEntries.length === 0) {
      return current;
    }

    return {
      ...current,
      ...Object.fromEntries(nextEntries),
    };
  }
}
