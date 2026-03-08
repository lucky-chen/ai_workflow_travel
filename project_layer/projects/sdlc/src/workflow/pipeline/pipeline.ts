// Pipeline module: provides the workflow entry point that will launch stage execution.
import type {
  ITraceRecorder,
  IPipeline,
  LaunchTaskRequest,
  StageOutput,
  StageRunContext,
  TaskRecord,
  TaskStatus,
} from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, TaskId, StageId } from "../../shared/types/common.js";
import { LaunchValidator } from "./launch-validator.js";
import { continueAfterArchitectureDesign } from "./module-design-fanout.js";
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

      const output = await stage.runner.run(context);
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

      // Special continuation flow:
      // 1. after architecture_design, parse ordered modules from the accepted architecture result
      // 2. run one module_design per module in sequence
      // 3. aggregate accepted outputs into module_design_documents before continuing to implementation_plan
      // Test entry: tests/pipeline-handoff.test.ts -> runPipelineHandoffTests()
      const architectureContinuation = await continueAfterArchitectureDesign({
        currentStageId,
        nextStageId: stage.nextStageId,
        taskId,
        workspaceRoot: request.workspaceRoot,
        attempt: context.attempt,
        params: request.params,
        currentInputArtifacts,
        stageOutput: output,
        moduleStageDefinition: currentStageId === "architecture_design" && stage.nextStageId === "module_design"
          ? this.registry.get("module_design")
          : undefined,
      }, {
        mergeInputArtifacts: (current, stageOutput) => this.mergeInputArtifacts(current, stageOutput),
        resolveStageStatus: (stageOutput) => this.resolveStageStatus(stageOutput),
        updateTaskAfterModuleRun: (moduleContext, moduleOutput) => {
          this.taskRuntimeStore.updateTask(taskId, {
            currentStageId: "module_design",
            inputArtifacts: moduleContext.inputArtifacts,
            lastOutput: moduleOutput,
          });
        },
        onModuleStageFailure: async (failedTaskId) => {
          this.taskRuntimeStore.updateTask(failedTaskId, {
            status: "failed",
          });
          await this.traceRecorder?.recordTrace({
            taskId: failedTaskId,
            stageId: "module_design",
            eventType: "stage_failed",
            summary: 'Stage "module_design" failed.',
          });
        },
      });

      if (architectureContinuation.matched) {
        currentInputArtifacts = architectureContinuation.nextInputArtifacts;
        currentStageId = architectureContinuation.nextStageId;
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
}
