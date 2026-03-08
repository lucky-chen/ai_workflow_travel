import type { ChangedFile, ProjectFile } from "../../shared/types/common.js";
export interface ModuleDesignDoc {
    content: string;
}
export interface ProjectContext {
    rootPath: string;
    relevantFiles: ProjectFile[];
}
export interface PromptBuildInput {
    moduleDesignDoc: ModuleDesignDoc;
    projectContext: ProjectContext;
}
export interface ApplyResult {
    changedFiles: ChangedFile[];
    summary: string;
}
export interface ParsedGenerationResult {
    changedFiles: ChangedFile[];
    summary: string;
}
