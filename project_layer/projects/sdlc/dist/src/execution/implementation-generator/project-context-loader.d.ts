import type { StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ProjectContext } from "./types.js";
export declare class ProjectContextLoader {
    private static readonly EXCLUDED_DIRECTORIES;
    private static readonly MAX_FILE_COUNT;
    private static readonly MAX_FILE_SIZE_BYTES;
    loadProjectContext(context: StageRunContext): Promise<ProjectContext>;
    private collectProjectFiles;
    private walkDirectory;
    private readProjectFile;
}
