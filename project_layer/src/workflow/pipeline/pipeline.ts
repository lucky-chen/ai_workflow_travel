import type { IPipeline, LaunchTaskRequest } from "../../shared/contracts/pipeline.js";
import type { TaskId } from "../../shared/types/common.js";

export class PipelineService implements IPipeline {
  async launchTask(_request: LaunchTaskRequest): Promise<TaskId> {
    return `task-${Date.now()}`;
  }
}
