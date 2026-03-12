// Module design loader: resolves and loads the upstream module design artifact for implementation generation.
import path from "node:path";

import type { IArtifactStore } from "../../shared/contracts/pipeline.js";
import type { StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, ArtifactRef } from "../../shared/types/common.js";
import type { ModuleDesignDoc } from "./types.js";

export class ModuleDesignLoader {
  constructor(private readonly artifactStore: IArtifactStore) {}

  async loadModuleDesign(context: StageRunContext): Promise<ModuleDesignDoc> {
    const ref = this.resolveRef(context.inputArtifacts);
    const content = await this.artifactStore.getArtifact({
      taskId: context.taskId,
      stageId: context.params?.moduleDesignStageId ?? context.stageId,
      filePath: ref,
      workspaceRoot: context.workspaceRoot,
    });

    return {
      moduleName: path.basename(ref, path.extname(ref)),
      content,
    };
  }

  private resolveRef(inputArtifacts: ArtifactMap): ArtifactRef {
    const ref = inputArtifacts.moduleDesign ?? inputArtifacts.module_design;
    if (!ref) {
      throw new Error("Missing module design artifact reference.");
    }

    return ref;
  }
}
