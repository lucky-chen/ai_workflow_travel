// Pipeline module: provides the workflow entry point that will launch stage execution.
import type { IPipeline, LaunchTaskRequest } from "../../shared/contracts/pipeline.js";
import type { TaskId } from "../../shared/types/common.js";

// Public API: workflow entry used by CLI or other callers to launch a task.
export class PipelineService implements IPipeline {
  async launchTask(_request: LaunchTaskRequest): Promise<TaskId> {
    return `task-${Date.now()}`;
  }
}
