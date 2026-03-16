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
import { TRACE_EVENT_TYPES, toCanonicalStageId } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, TaskId, StageId } from "../../shared/types/common.js";
import { LaunchValidator } from "./launch-validator.js";
import { StageRegistry } from "./stage-registry.js";
import { TaskRuntimeStore } from "./task-runtime-store.js";
import { TraceService } from "../../quality-gate/trace-recorder.js";

export interface PipelineServiceDependencies {
  registry: StageRegistry;
  launchValidator?: LaunchValidator;
  traceRecorder?: ITraceRecorder;
  taskRuntimeStore?: TaskRuntimeStore;
}

// Public API: workflow entry used by CLI or other callers to launch a task.
export class PipelineService implements IPipeline {
  private static readonly NON_FORWARD_ARTIFACT_KEYS = new Set([
    "artifactKey",
    "content",
    "summary",
    "moduleName",
    "documentPath",
  ]);
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
    const startStageId = this.registry.resolveStageId(request.startStageId);
    const triggerReason = request.triggerReason ?? "new_run";
    const taskId = request.taskId ?? this.createTaskId();
    const runId = request.runId?.trim() || this.createRunId();
    const runTask = async (): Promise<TaskId> => {
      this.registry.validate();
      this.launchValidator.validate({
        ...request,
        startStageId,
      }, this.registry);

      if (triggerReason === "new_run" || !this.getTaskRecord(taskId)) {
        this.taskRuntimeStore.createTask(taskId, startStageId, request.workspaceRoot, request.inputArtifacts, runId);
      } else {
        const existingTask = this.getTaskRecord(taskId);
        if (!existingTask) {
          throw new Error(`Task "${taskId}" is not registered.`);
        }

        this.taskRuntimeStore.updateTask(taskId, {
          runId,
          startStageId,
          currentStageId: startStageId,
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
        caller: "PipelineService.launchTask",
        stageId: toCanonicalStageId(startStageId),
        eventType: TRACE_EVENT_TYPES.taskStarted,
        summary: `Task "${taskId}" started at stage "${toCanonicalStageId(startStageId)}".`,
      });

      let currentStageId: StageId | undefined = startStageId;
      let currentInputArtifacts: ArtifactMap = request.inputArtifacts;

      while (currentStageId) {
        const stage = this.registry.get(currentStageId);
        const context: StageRunContext = {
          taskId,
          runId: this.getTaskRecord(taskId)?.runId ?? runId,
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
            caller: "PipelineService.launchTask",
            stageId: toCanonicalStageId(currentStageId),
            eventType: TRACE_EVENT_TYPES.stageFailed,
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
            caller: "PipelineService.launchTask",
            stageId: toCanonicalStageId(currentStageId),
            eventType: TRACE_EVENT_TYPES.stageFailed,
            summary: `Stage "${currentStageId}" failed.`,
          });
          break;
        }

        if (request.stopAfterCurrentStage) {
          currentInputArtifacts = this.mergeInputArtifacts(currentInputArtifacts, output);
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
        caller: "PipelineService.launchTask",
        stageId: toCanonicalStageId(this.getTaskRecord(taskId)?.currentStageId ?? startStageId),
        eventType: TRACE_EVENT_TYPES.taskFinished,
        summary: `Task "${taskId}" finished.`,
      });

      return taskId;
    };

    if (this.traceRecorder instanceof TraceService) {
      this.traceRecorder.setScope({ taskId, runId });
      try {
        return await runTask();
      } finally {
        this.traceRecorder.setScope(undefined);
      }
    }

    return runTask();
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

  private createRunId(): string {
    return String(Date.now());
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
          caller: "PipelineService.runStageContinuation",
          stageId: toCanonicalStageId(stageId),
          eventType: TRACE_EVENT_TYPES.stageFailed,
          summary,
        });
      },
    });
  }
}
