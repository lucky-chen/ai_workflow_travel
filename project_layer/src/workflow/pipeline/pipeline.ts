// Pipeline module: provides the workflow entry point that will launch stage execution.
import type {
  IPipeline,
  LaunchTaskRequest,
  StageOutput,
  StageRunContext,
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
  private readonly recentOutputs = new Map<TaskId, StageOutput>();

  constructor(dependencies: PipelineServiceDependencies) {
    this.registry = dependencies.registry;
    this.launchValidator = dependencies.launchValidator ?? new LaunchValidator();
    this.traceRecorder = dependencies.traceRecorder;
  }

  async launchTask(request: LaunchTaskRequest): Promise<TaskId> {
    const taskId = this.createTaskId();
    this.launchValidator.validate(request, this.registry);
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
      this.recentOutputs.set(taskId, output);

      if (this.resolveStageStatus(output) === "failed") {
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

    await this.traceRecorder?.recordTrace({
      taskId,
      eventType: "task_finished",
      summary: `Task "${taskId}" finished.`,
    });

    return taskId;
  }

  getLastOutput(taskId: TaskId): StageOutput | undefined {
    return this.recentOutputs.get(taskId);
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
