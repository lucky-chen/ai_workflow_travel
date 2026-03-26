import { cp, mkdir, writeFile } from "node:fs/promises";
import { getBundledResourcesDir } from "../../Capability/Shared/resource-paths.js";
import {
  getDefaultWorkspaceLocalEnvContent,
  resolveWorkspaceLocalEnvPath,
} from "./workspace-local-env.js";
import type { WorkspaceInitializer } from "./cli-types.js";

export class ResourceWorkspaceInitializer implements WorkspaceInitializer {
  async initialize(workspaceRoot: string): Promise<string> {
    const targetRoot = `${workspaceRoot}/sdlc`;
    const targetResourcesDirectory = `${targetRoot}/resources`;
    const targetLocalEnvPath = resolveWorkspaceLocalEnvPath(workspaceRoot);
    const sourceResourcesDirectory = getBundledResourcesDir();

    await mkdir(targetRoot, { recursive: true });
    await cp(sourceResourcesDirectory, targetResourcesDirectory, { recursive: true });
    await this.ensureLocalEnvFile(targetLocalEnvPath);

    return targetResourcesDirectory;
  }

  private async ensureLocalEnvFile(targetPath: string): Promise<void> {
    try {
      await writeFile(targetPath, getDefaultWorkspaceLocalEnvContent(), { encoding: "utf8", flag: "wx" });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "EEXIST") {
        throw error;
      }
    }
  }
}
