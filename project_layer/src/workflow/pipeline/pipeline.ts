// Pipeline module: provides the workflow entry point that will launch stage execution.
import type {
  IPipeline,
  LaunchTaskRequest,
  IStageRunner,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { StageId, TaskId } from "../../shared/types/common.js";

export interface PipelineServiceDependencies {
  stages: Partial<Record<StageId, IStageRunner>>;
}

// Public API: workflow entry used by CLI or other callers to launch a task.
export class PipelineService implements IPipeline {
  private readonly stages: Partial<Record<StageId, IStageRunner>>;
  private readonly recentOutputs = new Map<TaskId, StageOutput>();

  constructor(dependencies: PipelineServiceDependencies) {
    this.stages = dependencies.stages;
  }

  async launchTask(request: LaunchTaskRequest): Promise<TaskId> {
    const taskId = this.createTaskId();
    const stage = this.stages[request.startStageId];

    if (!stage) {
      throw new Error(`No stage registered for startStageId "${request.startStageId}".`);
    }

    const context: StageRunContext = {
      taskId,
      stageId: request.startStageId,
      workspaceRoot: request.workspaceRoot,
      inputArtifacts: request.inputArtifacts,
      params: request.params,
    };

    const output = await stage.run(context);
    this.recentOutputs.set(taskId, output);
    return taskId;
  }

  getLastOutput(taskId: TaskId): StageOutput | undefined {
    return this.recentOutputs.get(taskId);
  }

  private createTaskId(): TaskId {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
