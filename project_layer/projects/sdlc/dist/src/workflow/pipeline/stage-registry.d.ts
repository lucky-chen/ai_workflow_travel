import type { StageDefinition } from "../../shared/contracts/pipeline.js";
import type { StageId } from "../../shared/types/common.js";
export declare class StageRegistry {
    private readonly definitions;
    register(definition: StageDefinition): void;
    get(stageId: StageId): StageDefinition;
    has(stageId: StageId): boolean;
    validate(): void;
}
