import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { McpProjectRegistryService } from "../../src/Interface/Mcp/project-registry.js";

export async function runMcpProjectRegistryTests(): Promise<void> {
  await testResolveExplicitProjectName();
  await testResolveDefaultProjectFallback();
  await testRejectUnregisteredProjectName();
  await testRejectMissingDefaultProject();
}

async function testResolveExplicitProjectName(): Promise<void> {
  const repoRoot = await createTempRepoRoot("mcp-project-registry-explicit-");

  try {
    await writeRegistryConfig(repoRoot, {
      default_project: "hello-service",
      projects: [
        { project_name: "hello-service", project_dir: "user_projects/hello-service" },
        { project_name: "todo-service", project_dir: "user_projects/todo-service" },
      ],
    });

    const service = createRegistryService(repoRoot);
    const resolved = await service.resolveProject("todo-service");
    assert.deepEqual(resolved, {
      projectName: "todo-service",
      projectDir: path.join(repoRoot, "user_projects", "todo-service"),
      workspaceRoot: path.join(repoRoot, "user_projects", "todo-service"),
    });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function testResolveDefaultProjectFallback(): Promise<void> {
  const repoRoot = await createTempRepoRoot("mcp-project-registry-default-");

  try {
    await writeRegistryConfig(repoRoot, {
      default_project: "hello-service",
      projects: [
        { project_name: "hello-service", project_dir: "user_projects/hello-service" },
      ],
    });

    const service = createRegistryService(repoRoot);
    const resolved = await service.resolveProject();
    assert.deepEqual(resolved, {
      projectName: "hello-service",
      projectDir: path.join(repoRoot, "user_projects", "hello-service"),
      workspaceRoot: path.join(repoRoot, "user_projects", "hello-service"),
    });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function testRejectUnregisteredProjectName(): Promise<void> {
  const repoRoot = await createTempRepoRoot("mcp-project-registry-missing-");

  try {
    await writeRegistryConfig(repoRoot, {
      default_project: "hello-service",
      projects: [
        { project_name: "hello-service", project_dir: "user_projects/hello-service" },
      ],
    });

    const service = createRegistryService(repoRoot);
    await assert.rejects(
      async () => service.resolveProject("unknown-service"),
      /is not registered/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

async function testRejectMissingDefaultProject(): Promise<void> {
  const repoRoot = await createTempRepoRoot("mcp-project-registry-no-default-");

  try {
    await writeRegistryConfig(repoRoot, {
      projects: [
        { project_name: "hello-service", project_dir: "user_projects/hello-service" },
      ],
    });

    const service = createRegistryService(repoRoot);
    await assert.rejects(
      async () => service.resolveProject(),
      /default_project is not configured/,
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

function createRegistryService(repoRoot: string): McpProjectRegistryService {
  return new McpProjectRegistryService({
    cwd: () => path.join(repoRoot, "user_projects", "hello-service"),
  });
}

async function createTempRepoRoot(prefix: string): Promise<string> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  await mkdir(path.join(repoRoot, "infra_projects", "projects", "sdlc"), { recursive: true });
  await writeFile(path.join(repoRoot, "infra_projects", "projects", "sdlc", "package.json"), "{}\n", "utf8");
  await mkdir(path.join(repoRoot, "infra_projects", "config"), { recursive: true });
  return repoRoot;
}

async function writeRegistryConfig(
  repoRoot: string,
  config: {
    default_project?: string;
    projects: Array<{ project_name: string; project_dir: string }>;
  },
): Promise<void> {
  await writeFile(
    path.join(repoRoot, "infra_projects", "config", "mcp_projects.json"),
    JSON.stringify(config, null, 2),
    "utf8",
  );
}
