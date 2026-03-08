import type { StageDefinition } from "../../shared/contracts/pipeline.js";
import type { StageId } from "../../shared/types/common.js";

export class StageRegistry {
  private readonly definitions = new Map<StageId, StageDefinition>();

  register(definition: StageDefinition): void {
    if (this.definitions.has(definition.stageId)) {
      throw new Error(`Stage definition already registered for stageId "${definition.stageId}".`);
    }

    this.definitions.set(definition.stageId, definition);
  }

  get(stageId: StageId): StageDefinition {
    const definition = this.definitions.get(stageId);
    if (!definition) {
      throw new Error(`No stage definition registered for stageId "${stageId}".`);
    }

    return definition;
  }

  has(stageId: StageId): boolean {
    return this.definitions.has(stageId);
  }

  validate(): void {
    for (const definition of this.definitions.values()) {
      if (definition.nextStageId && !this.definitions.has(definition.nextStageId)) {
        throw new Error(
          `Stage definition "${definition.stageId}" references missing nextStageId "${definition.nextStageId}".`,
        );
      }
    }
  }
}
