// Item design loader: resolves and loads the upstream item design artifact for work execution.
import path from "node:path";

import type { ExecutionContext } from "../../../Runtime/Unit/execution-unit.js";
import type { ArtifactMap, ArtifactRef } from "../../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../../Data/artifact-store.js";
import type { ItemDesignDoc } from "./types.js";

export class ItemDesignLoader {
  constructor(private readonly artifactStore: IArtifactStore) {}

  async loadItemDesign(context: ExecutionContext): Promise<ItemDesignDoc> {
    const ref = this.resolveRef(context.inputArtifacts);
    const content = await this.artifactStore.getArtifact({
      taskId: context.taskId,
      executionUnitId: context.params?.moduleDesignExecutionUnitId ?? context.executionUnitId,
      filePath: ref,
      workspaceRoot: context.workspaceRoot,
    });

    return {
      itemName: path.basename(ref, path.extname(ref)),
      content,
    };
  }

  private resolveRef(inputArtifacts: ArtifactMap): ArtifactRef {
    const ref = inputArtifacts.moduleDesign ?? inputArtifacts.item_design;
    if (!ref) {
      throw new Error("Missing item design artifact reference.");
    }

    return ref;
  }
}
