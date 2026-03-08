import type { ITraceRecorder, IPipeline, LaunchTaskRequest, StageOutput, TaskRecord, TaskStatus } from "../../shared/contracts/pipeline.js";
import type { TaskId } from "../../shared/types/common.js";
import { LaunchValidator } from "./launch-validator.js";
import { StageRegistry } from "./stage-registry.js";
import { TaskRuntimeStore } from "./task-runtime-store.js";
export interface PipelineServiceDependencies {
    registry: StageRegistry;
    launchValidator?: LaunchValidator;
    traceRecorder?: ITraceRecorder;
    taskRuntimeStore?: TaskRuntimeStore;
}
export declare class PipelineService implements IPipeline {
    private readonly registry;
    private readonly launchValidator;
    private readonly traceRecorder?;
    private readonly taskRuntimeStore;
    constructor(dependencies: PipelineServiceDependencies);
    launchTask(request: LaunchTaskRequest): Promise<TaskId>;
    getLastOutput(taskId: TaskId): StageOutput | undefined;
    getTaskStatus(taskId: TaskId): TaskStatus | undefined;
    getTaskRecord(taskId: TaskId): TaskRecord | undefined;
    private createTaskId;
    private resolveStageStatus;
    private mergeInputArtifacts;
}
