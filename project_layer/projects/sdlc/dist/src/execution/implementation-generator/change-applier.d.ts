import type { LlmExecutionResult } from "../../sdk/llm-executor/llm-executor.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ApplyResult } from "./types.js";
export declare class ChangeApplier {
    parseGeneratedChanges(result: LlmExecutionResult): ApplyResult;
    applyChangedFiles(changedFiles: ChangedFile[], workspaceRoot: string): Promise<ChangedFile[]>;
    private parseResult;
    private applySingleChange;
    private resolveWorkspacePath;
}
