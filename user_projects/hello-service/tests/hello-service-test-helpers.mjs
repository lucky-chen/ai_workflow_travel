import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(workspaceRoot, "..", "..");
const sdlcProjectRoot = path.join(projectRoot, "project_layer", "projects", "sdlc");
const cliEntry = path.join(sdlcProjectRoot, "bin", "sdlc.js");

export async function createWorkspaceCopy() {
  const copiedWorkspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hello-service-sdlc-"));
  await cp(workspaceRoot, copiedWorkspaceRoot, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = path.relative(workspaceRoot, sourcePath);
      if (!relativePath) {
        return true;
      }

      const topLevelName = relativePath.split(path.sep)[0];
      return !["node_modules", "dist", ".artifact-store", "reports"].includes(topLevelName);
    },
  });
  await normalizeLocalEnvForCurrentCli(copiedWorkspaceRoot);
  return copiedWorkspaceRoot;
}

export async function removeWorkspace(targetWorkspaceRoot) {
  await rm(targetWorkspaceRoot, { recursive: true, force: true });
}

export async function resetWorkspace(targetWorkspaceRoot) {
  await rm(path.join(targetWorkspaceRoot, "dist"), { recursive: true, force: true });
  await rm(path.join(targetWorkspaceRoot, "src"), { recursive: true, force: true });
  await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design"), { recursive: true, force: true });
  await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json"), { force: true });
  await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "work_plan.yaml"), { force: true });
}

export async function runCli(targetWorkspaceRoot, args, options = {}) {
  const result = await executeCli(targetWorkspaceRoot, args, options);
  assert.equal(result.exitCode, 0, `CLI failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

export async function runCliExpectFailure(targetWorkspaceRoot, args, options = {}) {
  const result = await executeCli(targetWorkspaceRoot, args, options);
  assert.notEqual(result.exitCode, 0, `CLI unexpectedly succeeded.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

async function executeCli(targetWorkspaceRoot, args, options = {}) {
  const { taskId = "hello-service-task", runId, extraEnv = {}, runtimeMode = "mock" } = options;
  const commandArgs = [...args, "--workdir", targetWorkspaceRoot];
  if (runId) {
    commandArgs.push("--run-id", runId);
  }

  const scenarioEnv = runtimeMode === "mock"
    ? {
        SDLC_TEST_SCENARIO: "fixed_workspace_baseline",
        SDLC_TEST_SERVICE_NAME: "hello-service",
      }
    : {};

  const child = spawn(process.execPath, [cliEntry, ...commandArgs], {
    cwd: sdlcProjectRoot,
    env: {
      ...process.env,
      ...scenarioEnv,
      SDLC_TEST_TASK_ID: taskId,
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

  return {
    exitCode,
    stdout,
    stderr,
  };
}

export function getTraceFilePath(targetWorkspaceRoot, runId) {
  return path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "trace.json");
}

export async function loadTraceRecords(targetWorkspaceRoot, runId) {
  return JSON.parse(await readFile(getTraceFilePath(targetWorkspaceRoot, runId), "utf8"));
}

export function findTraceRecordsByEventType(records, eventType) {
  return records.filter((entry) => entry.payload?.eventType === eventType);
}

export function findTraceRecordsByExecutionUnit(records, executionUnitId) {
  return records.filter((entry) => entry.scope?.executionUnitId === executionUnitId);
}

export function findTraceRecordsByCategory(records, category) {
  return records.filter((entry) => entry.category === category);
}

export function assertUnitLlmTrace(records, { executionUnitId, runtimeMode }) {
  assert.equal(
    findTraceRecordsByExecutionUnit(records, executionUnitId).some(
      (entry) =>
        entry.payload?.eventType === "llm_execution_started"
        && entry.payload?.metadata?.mode === runtimeMode,
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByExecutionUnit(records, executionUnitId).some(
      (entry) => entry.payload?.eventType === "llm_execution_finished",
    ),
    true,
  );
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function createItemDescriptor(targetWorkspaceRoot) {
  const descriptorDirectory = path.join(targetWorkspaceRoot, "tmp");
  await mkdir(descriptorDirectory, { recursive: true });
  const descriptorPath = path.join(descriptorDirectory, "workflow-item.json");
  await writeFile(
    descriptorPath,
    JSON.stringify({
      name: "Workflow",
      responsibilities: [
        "define the hello function contract",
        "keep implementation minimal",
      ],
      documentPath: "sdlc/docs/item_design/Workflow.md",
      description: "Workflow item design baseline.",
    }, null, 2),
    "utf8",
  );
  return path.relative(targetWorkspaceRoot, descriptorPath);
}

export async function createPreparedStepContext(targetWorkspaceRoot) {
  const requirementDocument = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8");
  const architectureDocument = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8");
  const itemDesignDocument = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "utf8");

  const contextDirectory = path.join(targetWorkspaceRoot, "tmp");
  await mkdir(contextDirectory, { recursive: true });
  const preparedStepContextPath = path.join(contextDirectory, "prepared-step-context.json");
  await writeFile(
    preparedStepContextPath,
    JSON.stringify({
      workplanRef: "sdlc/docs/work_plan.yaml#step-1.batch-1",
      workplan: {
        steps: [
          {
            stepId: "step-1",
            title: "Workflow baseline",
            status: "not_started",
            architectureModulesInScope: ["Workflow"],
            batches: [
              {
                batchId: "batch-1",
                title: "Create source file",
                status: "not_started",
                tasks: ["add src/index.ts with hello export"],
              },
            ],
          },
        ],
      },
      currentBatch: {
        batchId: "batch-1",
        title: "Create source file",
        status: "not_started",
        tasks: ["add src/index.ts with hello export"],
      },
      upstreamContext: {
        requirementDocument,
        architectureDocument,
        itemDesignDocuments: [
          {
            itemName: "Workflow",
            content: itemDesignDocument,
          },
        ],
      },
    }, null, 2),
    "utf8",
  );
  return path.relative(targetWorkspaceRoot, preparedStepContextPath);
}

async function normalizeLocalEnvForCurrentCli(targetWorkspaceRoot) {
  const localEnvPath = path.join(targetWorkspaceRoot, "sdlc", "local_env.json");
  const localEnv = JSON.parse(await readFile(localEnvPath, "utf8"));
  if (localEnv.resources?.root_dir) {
    return;
  }

  const templateDir = localEnv.resources?.template_dir;
  const contractDir = localEnv.resources?.contract_dir;
  const rootDirCandidate = templateDir
    ? path.dirname(templateDir)
    : contractDir
      ? path.dirname(contractDir)
      : null;

  localEnv.resources = rootDirCandidate
    ? { root_dir: rootDirCandidate }
    : { root_dir: "../../meta_layer/resources" };
  await writeFile(localEnvPath, `${JSON.stringify(localEnv, null, 2)}\n`, "utf8");
}
