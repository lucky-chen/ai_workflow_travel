import { access, readFile } from "node:fs/promises";
import path from "node:path";

export interface RegisteredProject {
  project_name: string;
  project_dir: string;
}

export interface RegisteredProjectConfig {
  default_project?: string;
  projects: RegisteredProject[];
}

export interface ResolvedMcpProject {
  projectName: string;
  projectDir: string;
  workspaceRoot: string;
}

export interface McpProjectRegistryDependencies {
  cwd?: () => string;
  readFile?: typeof readFile;
  fileExists?: (targetPath: string) => Promise<boolean>;
}

export class McpProjectRegistryService {
  private readonly cwd: () => string;

  private readonly readFileImpl: typeof readFile;

  private readonly fileExistsImpl: (targetPath: string) => Promise<boolean>;

  constructor(dependencies: McpProjectRegistryDependencies = {}) {
    this.cwd = dependencies.cwd ?? (() => process.cwd());
    this.readFileImpl = dependencies.readFile ?? readFile;
    this.fileExistsImpl = dependencies.fileExists ?? fileExists;
  }

  async resolveProject(projectName?: string): Promise<ResolvedMcpProject> {
    const repositoryRoot = await this.resolveRepositoryRoot();
    const config = await this.loadConfig(repositoryRoot);
    const resolvedName = projectName?.trim() || config.default_project?.trim();

    if (!resolvedName) {
      throw new Error("Unable to resolve MCP project: project_name is missing and default_project is not configured.");
    }

    const project = config.projects.find((entry) => entry.project_name === resolvedName);
    if (!project) {
      throw new Error(`Unable to resolve MCP project: "${resolvedName}" is not registered.`);
    }

    const projectDir = path.isAbsolute(project.project_dir)
      ? project.project_dir
      : path.resolve(repositoryRoot, project.project_dir);

    return {
      projectName: project.project_name,
      projectDir,
      workspaceRoot: projectDir,
    };
  }

  async resolveConfigPath(startDir?: string): Promise<string> {
    const repositoryRoot = await this.resolveRepositoryRoot(startDir);
    return path.join(repositoryRoot, "project_layer", "config", "mcp_projects.json");
  }

  private async loadConfig(repositoryRoot: string): Promise<RegisteredProjectConfig> {
    const configPath = path.join(repositoryRoot, "project_layer", "config", "mcp_projects.json");
    let raw: string;
    try {
      raw = await this.readFileImpl(configPath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Missing MCP project registry config: ${configPath}`);
      }

      throw error;
    }

    let parsed: RegisteredProjectConfig;
    try {
      parsed = JSON.parse(raw) as RegisteredProjectConfig;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid MCP project registry JSON: ${configPath}. ${message}`);
    }

    if (!Array.isArray(parsed.projects)) {
      throw new Error(`Invalid MCP project registry config: ${configPath}. "projects" must be an array.`);
    }

    return parsed;
  }

  private async resolveRepositoryRoot(startDir = this.cwd()): Promise<string> {
    let currentDir = path.resolve(startDir);

    while (true) {
      const markerPath = path.join(currentDir, "project_layer", "projects", "sdlc", "package.json");
      if (await this.fileExistsImpl(markerPath)) {
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        throw new Error(`Unable to locate repository root from: ${startDir}`);
      }

      currentDir = parentDir;
    }
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
