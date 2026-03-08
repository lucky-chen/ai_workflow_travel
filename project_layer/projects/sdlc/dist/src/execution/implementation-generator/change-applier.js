// Change applier: validates and applies generated file changes into the target workspace.
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
export class ChangeApplier {
    parseGeneratedChanges(result) {
        const parsed = this.parseResult(result);
        return {
            changedFiles: parsed.changedFiles,
            summary: parsed.summary,
        };
    }
    async applyChangedFiles(changedFiles, workspaceRoot) {
        const applied = [];
        for (const file of changedFiles) {
            await this.applySingleChange(file, workspaceRoot);
            applied.push(file);
        }
        return applied;
    }
    parseResult(result) {
        try {
            const parsed = JSON.parse(result.content);
            return {
                summary: parsed.summary ?? "Implementation changes generated.",
                changedFiles: (parsed.changed_files ?? []).map((file) => ({
                    path: file.path,
                    operation: file.operation,
                    content: file.content,
                })),
            };
        }
        catch {
            return {
                summary: "Implementation changes generated.",
                changedFiles: [],
            };
        }
    }
    async applySingleChange(file, workspaceRoot) {
        const targetPath = this.resolveWorkspacePath(workspaceRoot, file.path);
        if (file.operation === "delete") {
            try {
                await unlink(targetPath);
            }
            catch (error) {
                const nodeError = error;
                if (nodeError.code !== "ENOENT") {
                    throw error;
                }
            }
            return;
        }
        if (typeof file.content !== "string") {
            throw new Error(`Missing file content for ${file.operation} operation: ${file.path}`);
        }
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, file.content, "utf8");
    }
    resolveWorkspacePath(workspaceRoot, relativePath) {
        const normalizedRoot = path.resolve(workspaceRoot);
        const candidate = path.resolve(normalizedRoot, relativePath);
        const relativeToRoot = path.relative(normalizedRoot, candidate);
        if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
            throw new Error(`Refusing to write outside workspace root: ${relativePath}`);
        }
        return candidate;
    }
}
