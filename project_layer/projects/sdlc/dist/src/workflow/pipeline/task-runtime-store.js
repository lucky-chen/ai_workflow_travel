export class TaskRuntimeStore {
    tasks = new Map();
    createTask(taskId, startStageId, workspaceRoot, inputArtifacts) {
        this.tasks.set(taskId, {
            taskId,
            startStageId,
            currentStageId: startStageId,
            attempt: 1,
            status: "pending",
            workspaceRoot,
            inputArtifacts,
        });
    }
    updateTask(taskId, updates) {
        const current = this.tasks.get(taskId);
        if (!current) {
            throw new Error(`Task "${taskId}" is not registered.`);
        }
        this.tasks.set(taskId, {
            ...current,
            ...updates,
        });
    }
    getTaskStatus(taskId) {
        return this.tasks.get(taskId)?.status;
    }
    getTaskRecord(taskId) {
        return this.tasks.get(taskId);
    }
    getLastOutput(taskId) {
        return this.tasks.get(taskId)?.lastOutput;
    }
}
