import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

export async function runHelloServiceFunctionalTest() {
  const workspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(workspaceRoot);

    await runCli(workspaceRoot, ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"], {
      runId: "hello-service-req",
    });
    await runCli(workspaceRoot, ["run", "unit", "architecture_design_generate"], { runId: "hello-service-arch" });

    const itemDescriptorPath = await createItemDescriptor(workspaceRoot);
    await runCli(
      workspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { runId: "hello-service-item" },
    );
    await runCli(workspaceRoot, ["run", "unit", "work_plan_generate"], { runId: "hello-service-plan" });

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
    await removeWorkspace(workspaceRoot);
  }
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceFunctionalTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
