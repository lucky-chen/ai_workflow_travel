import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BUNDLED_RESOURCES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../resources",
);

export function getBundledResourcesDir(): string {
  return DEFAULT_BUNDLED_RESOURCES_DIR;
}

export function getTemplateFilePath(workspaceRoot: string, fileName: string, resourceRoot?: string): string {
  return path.join(resolveResourcesRoot(workspaceRoot, resourceRoot), "template", fileName);
}

export function getContractFilePath(workspaceRoot: string, fileName: string, resourceRoot?: string): string {
  return path.join(resolveResourcesRoot(workspaceRoot, resourceRoot), "contract", fileName);
}

function resolveResourcesRoot(workspaceRoot: string, resourceRoot?: string): string {
  if (!resourceRoot) {
    return DEFAULT_BUNDLED_RESOURCES_DIR;
  }

  return path.isAbsolute(resourceRoot)
    ? resourceRoot
    : path.resolve(workspaceRoot, resourceRoot);
}
