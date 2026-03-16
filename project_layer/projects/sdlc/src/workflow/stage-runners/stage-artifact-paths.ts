import path from "node:path";

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function resolveRelativeWorkspacePath(workspaceRoot: string, ...segments: string[]): string {
  return toPosixPath(path.relative(workspaceRoot, path.join(workspaceRoot, ...segments)));
}

export function resolveImplementationPlanArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "work_plan.yaml");
}

export function resolveRequirementArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "Requirement.md");
}

export function resolveArchitectureArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md");
}

export function resolveArchitectureContractResultArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(
    workspaceRoot,
    "artifacts",
    "architecture",
    "architecture_design_contract_result.json",
  );
}

export function resolveOverallDesignContractResultArtifactPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(
    workspaceRoot,
    "artifacts",
    "design",
    "overall_design_contract_result.json",
  );
}

export function resolveModuleDesignDirectoryPath(workspaceRoot: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "module_design");
}

export function resolveModuleDesignArtifactPath(workspaceRoot: string, moduleName: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "sdlc", "docs", "module_design", `${moduleName}.md`);
}

export function resolveStageGeneratedArtifactPath(workspaceRoot: string, stageId: string, fileName: string): string {
  return resolveRelativeWorkspacePath(workspaceRoot, "dist", "sdlc", "stage", stageId, fileName);
}
