import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWorkspaceCopy,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";
import { continueDocumentUpdateLoop } from "../../../infra_projects/projects/sdlc/dist/src/Runtime/external-update-loop.js";
import { ExternalMcpAdapterService } from "../../../infra_projects/projects/sdlc/dist/src/SDK/ExternalMcp/external-mcp-adapter.js";
import { InMemoryChangeGate } from "../../../infra_projects/projects/sdlc/dist/src/sdk/QualityControl/Gate/change-gate.js";

const successTaskId = "hello-service-external-update-loop-success-task";
const runId = "6200-external-update-loop-success";

export async function runHelloServiceExternalUpdateLoopSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { taskId: successTaskId, runId },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_update", "--user-comment", "Add one operational scenario for deployment checks."],
      { taskId: successTaskId, runId },
    );

    const updateResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "requirement_design_update_result.json"),
    );
    assert.equal(updateResult.action.payload.handoffType, "document_update");
    assert.equal(updateResult.action.payload.targetArtifact.artifactKey, "requirement_design");
    assert.equal(typeof updateResult.prompt, "string");
    assert.equal(updateResult.prompt.includes("deployment checks"), true);

    const refreshedRequirement = [
      "# 1. Background",
      "- hello-service needs deployment validation coverage.",
      "",
      "# 2. Operational Scenarios",
      "- verify deployment checks before release",
    ].join("\n");
    const adapter = new ExternalMcpAdapterService({
      async execute() {
        return {
          content: refreshedRequirement,
          responseFormat: "text",
        };
      },
    });
    const adapterResult = await adapter.execute(updateResult.action, {
      workspaceRoot: targetWorkspaceRoot,
    });
    const gate = new InMemoryChangeGate({
      decision: {
        action: "apply",
        summary: "Approved requirement update loop.",
      },
    });

    const loopResult = await continueDocumentUpdateLoop(gate, {
      taskId: successTaskId,
      executionUnitId: "requirement_design_update",
      initialResult: {
        accepted: true,
        summary: "Requirement update prompt generated.",
        externalAction: updateResult.action,
      },
      externalActionResult: adapterResult,
    });

    assert.deepEqual(gate.getLastRequest(), {
      taskId: successTaskId,
      executionUnitId: "requirement_design_update",
      summary: "Review external update result for requirement_design.",
      changedPaths: ["sdlc/docs/Requirement.md"],
      changedFiles: [
        {
          path: "sdlc/docs/Requirement.md",
          operation: "update",
          content: refreshedRequirement,
        },
      ],
    });
    assert.equal(loopResult.accepted, true);
    assert.equal(loopResult.continuation.branch, "continue");
    assert.equal(loopResult.continuation.resumeInput.requirement_design, refreshedRequirement);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceExternalUpdateLoopSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
