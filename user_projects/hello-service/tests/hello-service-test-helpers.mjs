import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(workspaceRoot, "..", "..");
const sdlcProjectRoot = path.join(projectRoot, "project_layer", "projects", "sdlc");
const cliEntry = path.join(sdlcProjectRoot, "bin", "sdlc.js");
const artifactRoot = path.join(workspaceRoot, ".artifact-store");
const historyRoot = path.join(workspaceRoot, ".trace-history-store");

export async function runCli(args, options = {}) {
  const { taskId = "hello-service-task", extraEnv = {} } = options;
  const child = spawn(process.execPath, [cliEntry, ...args], {
    cwd: sdlcProjectRoot,
    env: {
      ...process.env,
      SDLC_TEST_SCENARIO: "fixed_workspace_baseline",
      SDLC_TEST_TASK_ID: taskId,
      SDLC_TEST_SERVICE_NAME: "hello-service",
      SDLC_WORKSPACE_ROOT: workspaceRoot,
      SDLC_ARTIFACT_ROOT: artifactRoot,
      SDLC_HISTORY_ROOT: historyRoot,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  assert.equal(exitCode, 0, `CLI failed.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}

export async function resetWorkspace() {
  await rm(artifactRoot, { recursive: true, force: true });
  await rm(historyRoot, { recursive: true, force: true });
  await rm(path.join(workspaceRoot, "sdlc"), { recursive: true, force: true });
  await rm(path.join(workspaceRoot, "src"), { recursive: true, force: true });
}

export async function findTraceFilePath(taskId) {
  const traceDirectory = path.join(workspaceRoot, "sdlc", "trace");
  const entries = await readdir(traceDirectory, { withFileTypes: true });
  const match = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${taskId}_`) && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .at(-1);

  if (!match) {
    throw new Error(`Missing trace file for task "${taskId}".`);
  }

  return path.join(traceDirectory, match.name);
}

export async function loadAllTraceRecords(taskId) {
  const traceDirectory = path.join(workspaceRoot, "sdlc", "trace");
  const entries = await readdir(traceDirectory, { withFileTypes: true });
  const matchingFiles = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${taskId}_`) && entry.name.endsWith(".json"))
    .map((entry) => path.join(traceDirectory, entry.name))
    .sort();

  if (matchingFiles.length === 0) {
    throw new Error(`Missing trace file for task "${taskId}".`);
  }

  const recordGroups = await Promise.all(
    matchingFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))),
  );

  return recordGroups.flat();
}

export function createHelloServiceRequirementDocument() {
  return [
    "# 1. Background",
    "hello-service is a minimal service used to verify the SDLC baseline flow.",
    "",
    "# 2. User Scenarios",
    "Users need one simple endpoint-level service example.",
    "",
    "# 3. Product Goals",
    "- generate one minimal service implementation",
    "",
    "# 4. Core Problems and Product Abilities",
    "- provide one stable hello-service baseline for verification",
    "",
    "# 5. User Workflow",
    "- initialize workspace",
    "- generate design artifacts",
    "- generate code",
    "- validate workspace",
    "",
    "# 6. Inputs and Outputs",
    "- input: hello-service requirement",
    "- output: docs and src baseline",
    "",
    "# 7 Scope and Non-Goals",
    "- no production deployment in this verification step",
    "",
    "# 8. Success Criteria",
    "- documents and code are generated into the expected workspace layout",
    "",
    "# 9. Risks",
    "- baseline verification may expose path mismatches",
    "",
    "# 10. Constraints",
    "- keep the service intentionally minimal",
  ].join("\n");
}

export function createHelloServiceArchitectureDocument() {
  return [
    "# 1. System Overview",
    "hello-service uses a minimal function export as the service boundary.",
    "",
    "# 2. Runtime Flow",
    "The service exposes one hello function returning a stable string for hello-service.",
    "",
    "# 3. Module Design",
    "- Workflow",
    "",
    "# 4. Data and State",
    "No persistent state is required.",
    "",
    "# 5. Validation Strategy",
    "Validate that the generated file exists and exports the expected function.",
  ].join("\n");
}

export function createHelloServiceModuleDesignDocument() {
  return [
    "# 1. Module Overview",
    "Workflow coordinates the hello-service generation baseline.",
    "",
    "# 2. Responsibilities",
    "- define the hello function contract",
    "- keep implementation minimal",
    "",
    "# 3. Interfaces",
    "- export function hello(): string",
    "",
    "# 4. Dependencies",
    "- no external dependencies",
    "",
    "# 5. Risks and Constraints",
    "- keep the output intentionally minimal for verification",
  ].join("\n");
}

export function createHelloServiceImplementationPlanDocument() {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Goal",
    "- deliver the hello-service implementation baseline",
    "",
    "## 2. Scope",
    "- Workflow",
    "",
    "### Step 1. Deliver Baseline Service",
    "- [ ] `Step 1 is not started`",
    "  - [ ] `Workflow`",
    "- [ ] Batch 1: Create source file",
    "  - [ ] add src/index.ts with hello export",
    "",
    "## 4. Implementation Execution State",
    "- [x] batch-1",
  ].join("\n");
}
