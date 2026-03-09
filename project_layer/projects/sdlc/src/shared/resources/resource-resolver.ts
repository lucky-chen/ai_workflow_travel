import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function resolveWorkspaceResourcePath(
  workspaceRoot: string | undefined,
  relativePath: string,
): Promise<string | null> {
  if (!workspaceRoot) {
    return null;
  }

  const candidate = path.join(workspaceRoot, "sdlc", "resources", relativePath);
  return await pathExists(candidate) ? candidate : null;
}

export async function resolveBundledResourcesDirectory(): Promise<string> {
  const candidateDirectories = getBundledResourceRoots();

  for (const candidateDirectory of candidateDirectories) {
    if (await isNonEmptyDirectory(candidateDirectory)) {
      return candidateDirectory;
    }
  }

  throw new Error("Unable to locate bundled SDLC resources.");
}

export async function resolveResourcePath(
  relativePath: string,
  workspaceRoot?: string,
): Promise<string> {
  const workspaceResourcePath = await resolveWorkspaceResourcePath(workspaceRoot, relativePath);
  if (workspaceResourcePath) {
    return workspaceResourcePath;
  }

  for (const candidateRoot of getBundledResourceRoots()) {
    const candidatePath = path.join(candidateRoot, relativePath);
    if (await pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(`Unable to locate SDLC resource: ${relativePath}`);
}

export async function describeResourcePath(
  absolutePath: string,
  workspaceRoot?: string,
): Promise<string> {
  const normalizedPath = path.normalize(absolutePath);
  const workspaceResourcesRoot = workspaceRoot
    ? path.join(workspaceRoot, "sdlc", "resources")
    : null;

  if (workspaceResourcesRoot && isWithinRoot(normalizedPath, workspaceResourcesRoot)) {
    return toPosixPath(path.join("workspace", "sdlc", "resources", path.relative(workspaceResourcesRoot, normalizedPath)));
  }

  const bundledResourcesDirectory = await resolveBundledResourcesDirectory();
  if (isWithinRoot(normalizedPath, bundledResourcesDirectory)) {
    return toPosixPath(path.join("dist", "resources", path.relative(bundledResourcesDirectory, normalizedPath)));
  }

  return toPosixPath(normalizedPath);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getBundledResourceRoots(): string[] {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(currentDirectory, "..", "..", "..", "..", "resources"),
    path.resolve(process.cwd(), "dist", "resources"),
    path.resolve(process.cwd(), "..", "..", "..", "meta_layer", "resources"),
    path.resolve(currentDirectory, "..", "..", "..", "..", "..", "..", "..", "meta_layer", "resources"),
  ];
}

async function isNonEmptyDirectory(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    const entries = await readdir(targetPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function toPosixPath(targetPath: string): string {
  return targetPath.split(path.sep).join("/");
}
