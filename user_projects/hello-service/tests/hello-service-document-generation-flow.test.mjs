import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  createItemDescriptor,
  getPrimaryItemDesignDocumentPath,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

export async function runHelloServiceFunctionalTest() {
  const runId = "hello-service-document-generation-flow";
  const workspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(workspaceRoot);

    await runCli(workspaceRoot, ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"], {
      runId,
    });
    await runCli(workspaceRoot, ["run", "unit", "architecture_design_generate"], { runId });

    const itemDescriptorPath = await createItemDescriptor(workspaceRoot);
    await runCli(
      workspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { runId },
    );
    await runCli(workspaceRoot, ["run", "unit", "work_plan_generate"], { runId });

    const requirementDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8");
    const architectureDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8");
    const itemDesignDocument = await readFile(
      path.join(workspaceRoot, await getPrimaryItemDesignDocumentPath(workspaceRoot)),
      "utf8",
    );
    const workPlanDocument = await readFile(path.join(workspaceRoot, "sdlc", "docs", "work_plan.yaml"), "utf8");

    assert.match(requirementDocument, /hello-service/i);
    assert.match(requirementDocument, /# 1\. Background/);
    assert.match(architectureDocument, /hello-service uses a minimal function export/i);
    assert.match(itemDesignDocument, /coordinates the hello-service generation baseline/i);
    assert.match(workPlanDocument, /deliver the hello-service implementation baseline/i);
  } finally {
    await removeWorkspace(workspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceFunctionalTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
