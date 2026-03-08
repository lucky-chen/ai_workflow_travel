import type { IArtifactStore } from "../../shared/contracts/pipeline.js";
import type { StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ModuleDesignDoc } from "./types.js";
export declare class ModuleDesignLoader {
    private readonly artifactStore;
    constructor(artifactStore: IArtifactStore);
    loadModuleDesign(context: StageRunContext): Promise<ModuleDesignDoc>;
    private resolveRef;
}
