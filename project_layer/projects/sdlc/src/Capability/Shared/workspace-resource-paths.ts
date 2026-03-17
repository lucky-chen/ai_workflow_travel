import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface WorkspaceLocalEnvConfig {
  resources?: {
    root_dir?: string;
  };
}

const DEFAULT_BUNDLED_RESOURCES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../resources",
);

export function getBundledResourcesDir(): string {
  return DEFAULT_BUNDLED_RESOURCES_DIR;
}

export async function getTemplateFilePath(workspaceRoot: string, fileName: string): Promise<string> {
  const rootDir = await getConfiguredResourcesRoot(workspaceRoot);
  if (rootDir) {
    return path.join(rootDir, "template", fileName);
  }

  return path.join(DEFAULT_BUNDLED_RESOURCES_DIR, "template", fileName);
}

export async function getContractFilePath(workspaceRoot: string, fileName: string): Promise<string> {
  const rootDir = await getConfiguredResourcesRoot(workspaceRoot);
  if (rootDir) {
    return path.join(rootDir, "contract", fileName);
  }

  return path.join(DEFAULT_BUNDLED_RESOURCES_DIR, "contract", fileName);
}

async function getConfiguredResourcesRoot(workspaceRoot: string): Promise<string | null> {
  const localEnvPath = path.join(workspaceRoot, "sdlc", "local_env.json");

  let raw: string;
  try {
    raw = await readFile(localEnvPath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const parsed = JSON.parse(raw) as WorkspaceLocalEnvConfig;
  const rootDir = parsed.resources?.root_dir?.trim();
  return rootDir ? path.resolve(workspaceRoot, rootDir) : null;
}
