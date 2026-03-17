import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const sourceWorkspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(sourceWorkspaceRoot, "..", "..");
const sdlcProjectRoot = path.join(projectRoot, "project_layer", "projects", "sdlc");
const cliEntry = path.join(sdlcProjectRoot, "bin", "sdlc.js");

export async function runHelloServiceFunctionalTest() {
  const workspaceRoot = await createWorkspaceCopy();

  try {
    await runCli(workspaceRoot, ["run", "unit", "requirement_design_generate"], "hello-service-req");
    await runCli(workspaceRoot, ["run", "unit", "architecture_design_generate"], "hello-service-arch");

    const itemDescriptorPath = await createItemDescriptor(workspaceRoot);
    await runCli(
      workspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      "hello-service-item",
    );
    await runCli(workspaceRoot, ["run", "unit", "work_plan_generate"], "hello-service-plan");

    const requirementDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8");
    const architectureDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8");
    const itemDesignDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "item_design", "Workflow.md"), "utf8");
    const workPlanDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "work_plan.yaml"), "utf8");

    assert.match(requirementDocument, /hello-service/i);
    assert.match(requirementDocument, /# 1\. Background/);
    assert.match(architectureDocument, /hello-service uses a minimal function export/i);
    assert.match(itemDesignDocument, /Workflow coordinates the hello-service generation baseline/i);
    assert.match(workPlanDocument, /deliver the hello-service implementation baseline/i);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function createWorkspaceCopy() {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hello-service-sdlc-"));
  await cp(sourceWorkspaceRoot, workspaceRoot, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = path.relative(sourceWorkspaceRoot, sourcePath);
      if (!relativePath) {
        return true;
      }

      const topLevelName = relativePath.split(path.sep)[0];
      return !["node_modules", "dist", ".artifact-store", "reports"].includes(topLevelName);
    },
  });
  return workspaceRoot;
}

async function createItemDescriptor(workspaceRoot) {
  const descriptorDirectory = path.join(workspaceRoot, "tmp");
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
  return path.relative(workspaceRoot, descriptorPath);
}

async function runCli(workspaceRoot, args, runId) {
  const child = spawn(process.execPath, [cliEntry, ...args, "--workdir", workspaceRoot, "--run-id", runId], {
    cwd: sdlcProjectRoot,
    env: {
      ...process.env,
      SDLC_TEST_SCENARIO: "fixed_workspace_baseline",
      SDLC_TEST_SERVICE_NAME: "hello-service",
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceFunctionalTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
