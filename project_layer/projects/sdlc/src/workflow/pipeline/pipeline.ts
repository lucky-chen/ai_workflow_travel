// Pipeline module: provides the workflow entry point that will launch stage execution.
import type {
  ITraceRecorder,
  IPipeline,
  LaunchTaskRequest,
  StageContinuationResult,
  StageDefinition,
  StageOutput,
  StageRunContext,
  TaskRecord,
  TaskStatus,
} from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, TaskId, StageId } from "../../shared/types/common.js";
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
  private static readonly NON_FORWARD_ARTIFACT_KEYS = new Set(["artifactKey", "content", "summary", "moduleName"]);
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
    const triggerReason = request.triggerReason ?? "new_run";
    const taskId = triggerReason === "stage_entry" ? request.taskId ?? this.createTaskId() : this.createTaskId();
    this.registry.validate();
    this.launchValidator.validate(request, this.registry);

    if (triggerReason === "new_run" || !this.getTaskRecord(taskId)) {
      this.taskRuntimeStore.createTask(taskId, request.startStageId, request.workspaceRoot, request.inputArtifacts);
    } else {
      const existingTask = this.getTaskRecord(taskId);
      if (!existingTask) {
        throw new Error(`Task "${taskId}" is not registered.`);
      }

      this.taskRuntimeStore.updateTask(taskId, {
        startStageId: request.startStageId,
        currentStageId: request.startStageId,
        attempt: existingTask.attempt + 1,
        status: "pending",
        workspaceRoot: request.workspaceRoot,
        inputArtifacts: request.inputArtifacts,
        lastOutput: undefined,
      });
    }

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
        attempt: this.getTaskRecord(taskId)?.attempt ?? 1,
        workspaceRoot: request.workspaceRoot,
        inputArtifacts: currentInputArtifacts,
        params: request.params,
      };

      let output: StageOutput;
      try {
        output = await stage.runner.run(context);
      } catch (error) {
        this.taskRuntimeStore.updateTask(taskId, {
          currentStageId,
          inputArtifacts: currentInputArtifacts,
          status: "failed",
        });
        await this.traceRecorder?.recordTrace({
          taskId,
          stageId: currentStageId,
          eventType: "stage_failed",
          summary: error instanceof Error
            ? error.message
            : `Stage "${currentStageId}" failed.`,
        });
        break;
      }

      this.taskRuntimeStore.updateTask(taskId, {
        currentStageId,
        inputArtifacts: currentInputArtifacts,
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

      const continuation = await this.runStageContinuation(stage, {
        taskId,
        stageId: currentStageId,
        nextStageId: stage.nextStageId,
        attempt: context.attempt,
        workspaceRoot: request.workspaceRoot,
        inputArtifacts: currentInputArtifacts,
        stageOutput: output,
        params: request.params,
      });
      if (continuation) {
        currentInputArtifacts = continuation.nextInputArtifacts;
        currentStageId = continuation.nextStageId;
        continue;
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
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && !PipelineService.NON_FORWARD_ARTIFACT_KEYS.has(entry[0]),
    );

    if (nextEntries.length === 0) {
      return current;
    }

    return {
      ...current,
      ...Object.fromEntries(nextEntries),
    };
  }

  private async runStageContinuation(
    stage: StageDefinition,
    context: {
      taskId: TaskId;
      stageId: StageId;
      nextStageId?: StageId | null;
      attempt: number;
      workspaceRoot: string;
      inputArtifacts: ArtifactMap;
      stageOutput: StageOutput;
      params?: LaunchTaskRequest["params"];
    },
  ): Promise<StageContinuationResult | null> {
    if (!stage.continuation) {
      return null;
    }

    return stage.continuation.continue({
      taskId: context.taskId,
      stageId: context.stageId,
      nextStageId: context.nextStageId,
      attempt: context.attempt,
      workspaceRoot: context.workspaceRoot,
      inputArtifacts: context.inputArtifacts,
      stageOutput: context.stageOutput,
      params: context.params,
      mergeInputArtifacts: (current, output) => this.mergeInputArtifacts(current, output),
      resolveStageStatus: (output) => this.resolveStageStatus(output),
      updateTaskAfterStageRun: (stageContext, output) => {
        this.taskRuntimeStore.updateTask(context.taskId, {
          currentStageId: stageContext.stageId,
          inputArtifacts: stageContext.inputArtifacts,
          lastOutput: output,
        });
      },
      onStageFailure: async (stageId, inputArtifacts, summary) => {
        this.taskRuntimeStore.updateTask(context.taskId, {
          currentStageId: stageId,
          inputArtifacts,
          status: "failed",
        });
        await this.traceRecorder?.recordTrace({
          taskId: context.taskId,
          stageId,
          eventType: "stage_failed",
          summary,
        });
      },
    });
  }
}
