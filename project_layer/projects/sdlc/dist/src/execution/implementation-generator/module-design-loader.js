export class ModuleDesignLoader {
    artifactStore;
    constructor(artifactStore) {
        this.artifactStore = artifactStore;
    }
    async loadModuleDesign(context) {
        const ref = this.resolveRef(context.inputArtifacts);
        const content = await this.artifactStore.getArtifact({
            taskId: context.taskId,
            stageId: context.params?.moduleDesignStageId ?? context.stageId,
            filePath: ref,
        });
        return { content };
    }
    resolveRef(inputArtifacts) {
        const ref = inputArtifacts.moduleDesign ?? inputArtifacts.module_design;
        if (!ref) {
            throw new Error("Missing module design artifact reference.");
        }
        return ref;
    }
}
