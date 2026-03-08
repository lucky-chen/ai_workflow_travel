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

export interface PipelineServiceDependencies {
  registry: StageRegistry;
  launchValidator?: LaunchValidator;
  traceRecorder?: ITraceRecorder;
}

// Public API: workflow entry used by CLI or other callers to launch a task.
export class PipelineService implements IPipeline {
  private readonly registry: StageRegistry;
  private readonly launchValidator: LaunchValidator;
  private readonly traceRecorder?: ITraceRecorder;
  private readonly tasks = new Map<TaskId, TaskRecord>();

  constructor(dependencies: PipelineServiceDependencies) {
    this.registry = dependencies.registry;
    this.launchValidator = dependencies.launchValidator ?? new LaunchValidator();
    this.traceRecorder = dependencies.traceRecorder;
  }

  async launchTask(request: LaunchTaskRequest): Promise<TaskId> {
    const taskId = this.createTaskId();
    this.registry.validate();
    this.launchValidator.validate(request, this.registry);
    this.tasks.set(taskId, {
      taskId,
      startStageId: request.startStageId,
      currentStageId: request.startStageId,
      status: "pending",
      workspaceRoot: request.workspaceRoot,
    });

    this.updateTask(taskId, {
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
      this.updateTask(taskId, {
        currentStageId,
        lastOutput: output,
      });

      if (this.resolveStageStatus(output) === "failed") {
        this.updateTask(taskId, {
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
      this.updateTask(taskId, {
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
    return this.tasks.get(taskId)?.lastOutput;
  }

  getTaskStatus(taskId: TaskId): TaskStatus | undefined {
    return this.tasks.get(taskId)?.status;
  }

  getTaskRecord(taskId: TaskId): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  private createTaskId(): TaskId {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private updateTask(taskId: TaskId, updates: Partial<Omit<TaskRecord, "taskId">>): void {
    const current = this.tasks.get(taskId);
    if (!current) {
      throw new Error(`Task "${taskId}" is not registered.`);
    }

    this.tasks.set(taskId, {
      ...current,
      ...updates,
    });
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
