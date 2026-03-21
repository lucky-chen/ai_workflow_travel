import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createItemDescriptor,
  createWorkspaceCopy,
  invokeMcpTool,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const requirementRunId = "7301-mcp-requirement-generate";
const architectureRunId = "7302-mcp-architecture-generate";
const itemRunId = "7303-mcp-item-generate";
const workPlanRunId = "7304-mcp-work-plan-generate";
const updateRunId = "7305-mcp-requirement-update";
const workExecuteRunId = "7306-mcp-work-execute";

export async function runHelloServiceMcpUpdateWorkExecuteSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "requirement_design_generate", "--user-comment", "Generate requirement for hello-service"],
      { runId: requirementRunId },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "architecture_design_generate", "--user-comment", "Generate architecture for hello-service"],
      { runId: architectureRunId },
    );
    const itemDescriptorPath = await createItemDescriptor(targetWorkspaceRoot);
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_generate", "--item-descriptor-path", itemDescriptorPath],
      { runId: itemRunId },
    );
    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "work_plan_generate"],
      { runId: workPlanRunId },
    );

    const updateResult = await invokeMcpTool(
      targetWorkspaceRoot,
      {
        name: "requirement_design_update",
        arguments: {
          user_comment: "Add one deployment validation scenario",
        },
      },
      {
        runId: updateRunId,
      },
    );
    assert.equal(updateResult.status, "success");
    assert.equal(updateResult.files?.[0]?.role, "requirement_design");
    assert.deepEqual(updateResult.agentAction, {
      actionType: "update_markdown",
      targetPath: "sdlc/docs/Requirement.md",
      instructions: updateResult.agentAction?.instructions,
    });
    assert.equal(typeof updateResult.agentAction?.instructions, "string");
    assert.equal("externalAction" in updateResult, false);

    const workExecuteResult = await invokeMcpTool(
      targetWorkspaceRoot,
      {
        name: "work_execute",
        arguments: {},
      },
      {
        runId: workExecuteRunId,
      },
    );
    assert.equal(workExecuteResult.status, "success");
    assert.deepEqual(workExecuteResult.agentAction, {
      actionType: "apply_workspace_change",
      targetPath: targetWorkspaceRoot,
      instructions: workExecuteResult.agentAction?.instructions,
    });
    assert.equal(typeof workExecuteResult.agentAction?.instructions, "string");
    assert.equal("externalAction" in workExecuteResult, false);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceMcpUpdateWorkExecuteSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
