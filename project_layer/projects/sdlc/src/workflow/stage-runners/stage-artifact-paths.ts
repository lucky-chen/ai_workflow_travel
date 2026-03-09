import path from "node:path";

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function resolveRelativeWorkspacePath(workspaceRoot: string, ...segments: string[]): string {
  return toPosixPath(path.relative(workspaceRoot, path.join(workspaceRoot, ...segments)));
}

export function resolveImplementationPlanArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "CodeGenerationExecutionPlan.md");
}

export function resolveRequirementArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "requirements", "Requirement.md");
}

export function resolveArchitectureArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "architecture", "TechnicalArchitecture.md");
}

export function resolveModuleDesignArtifactPath(workspaceRoot: string, moduleName: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "module_design", `${moduleName}.md`);
}
