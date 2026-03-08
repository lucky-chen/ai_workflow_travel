import { LaunchValidator } from "./launch-validator.js";
import { TaskRuntimeStore } from "./task-runtime-store.js";
// Public API: workflow entry used by CLI or other callers to launch a task.
export class PipelineService {
    registry;
    launchValidator;
    traceRecorder;
    taskRuntimeStore;
    constructor(dependencies) {
        this.registry = dependencies.registry;
        this.launchValidator = dependencies.launchValidator ?? new LaunchValidator();
        this.traceRecorder = dependencies.traceRecorder;
        this.taskRuntimeStore = dependencies.taskRuntimeStore ?? new TaskRuntimeStore();
    }
    async launchTask(request) {
        const triggerReason = request.triggerReason ?? "new_run";
        const taskId = triggerReason === "stage_entry" ? request.taskId ?? this.createTaskId() : this.createTaskId();
        this.registry.validate();
        this.launchValidator.validate(request, this.registry);
        if (triggerReason === "new_run" || !this.getTaskRecord(taskId)) {
            this.taskRuntimeStore.createTask(taskId, request.startStageId, request.workspaceRoot, request.inputArtifacts);
        }
        else {
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
        let currentStageId = request.startStageId;
        let currentInputArtifacts = request.inputArtifacts;
        while (currentStageId) {
            const stage = this.registry.get(currentStageId);
            const context = {
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
    getLastOutput(taskId) {
        return this.taskRuntimeStore.getLastOutput(taskId);
    }
    getTaskStatus(taskId) {
        return this.taskRuntimeStore.getTaskStatus(taskId);
    }
    getTaskRecord(taskId) {
        return this.taskRuntimeStore.getTaskRecord(taskId);
    }
    createTaskId() {
        return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    resolveStageStatus(output) {
        if (output.status) {
            return output.status;
        }
        return output.success ? "completed" : "failed";
    }
    mergeInputArtifacts(current, output) {
        if (!output.artifacts || typeof output.artifacts !== "object") {
            return current;
        }
        const nextEntries = Object.entries(output.artifacts).filter((_entry) => typeof _entry[1] === "string");
        if (nextEntries.length === 0) {
            return current;
        }
        return {
            ...current,
            ...Object.fromEntries(nextEntries),
        };
    }
}
