export class StageRegistry {
    definitions = new Map();
    register(definition) {
        if (this.definitions.has(definition.stageId)) {
            throw new Error(`Stage definition already registered for stageId "${definition.stageId}".`);
        }
        this.definitions.set(definition.stageId, definition);
    }
    get(stageId) {
        const definition = this.definitions.get(stageId);
        if (!definition) {
            throw new Error(`No stage definition registered for stageId "${stageId}".`);
        }
        return definition;
    }
    has(stageId) {
        return this.definitions.has(stageId);
    }
    validate() {
        for (const definition of this.definitions.values()) {
            if (definition.nextStageId && !this.definitions.has(definition.nextStageId)) {
                throw new Error(`Stage definition "${definition.stageId}" references missing nextStageId "${definition.nextStageId}".`);
            }
        }
    }
}
