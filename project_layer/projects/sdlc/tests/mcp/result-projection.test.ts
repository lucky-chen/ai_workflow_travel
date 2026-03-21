import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { projectRuntimeResultToMcp } from "../../src/Interface/Mcp/result-projection.js";
import { McpToolRegistryService } from "../../src/Interface/Mcp/tool-registry.js";

export async function runMcpResultProjectionTests(): Promise<void> {
  await testProjectUpdateExternalActionToAgentAction();
  await testProjectContractFailureToIssuesAndFailedStatus();
}

async function testProjectUpdateExternalActionToAgentAction(): Promise<void> {
  const registry = new McpToolRegistryService();
  const result = await projectRuntimeResultToMcp({
    tool: registry.getTool("requirement_design_update"),
    args: {
      project_name: "hello-service",
      user_comment: "Refine requirement",
    },
    runtimeResult: {
      accepted: true,
      summary: "Requirement update prompt generated.",
      externalAction: {
        tool: "external_plugin",
        operation: "update_markdown",
        targetPath: "sdlc/docs/Requirement.md",
        payload: {
          handoffType: "document_update",
          prompt: "Update requirement document.",
          targetArtifact: {
            artifactKey: "requirement_design",
            filePath: "sdlc/docs/Requirement.md",
          },
        },
      },
    },
    workspaceRoot: "/tmp/workspace",
    runId: "run-1",
  });

  assert.deepEqual(result, {
    status: "success",
    message: "Requirement update prompt generated.",
    files: [
      {
        path: "sdlc/docs/Requirement.md",
        role: "requirement_design",
      },
    ],
    agentAction: {
      actionType: "update_markdown",
      targetPath: "sdlc/docs/Requirement.md",
      instructions: "Update requirement document.",
    },
  });
}

async function testProjectContractFailureToIssuesAndFailedStatus(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "mcp-result-projection-"));

  try {
    await mkdir(path.join(workspaceRoot, "dist", "sdlc", "run-2"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "dist", "sdlc", "run-2", "requirement_design_contract_result.json"),
      JSON.stringify({
        passed: false,
        summary: "Requirement design contract failed.",
        issues: [
          {
            severity: "high",
            message: "Missing required section.",
          },
        ],
      }, null, 2),
      "utf8",
    );

    const registry = new McpToolRegistryService();
    const result = await projectRuntimeResultToMcp({
      tool: registry.getTool("requirement_design_contract"),
      args: {
        project_name: "hello-service",
      },
      runtimeResult: {
        accepted: true,
        summary: "Persisted to requirement_design_contract_result.json.",
      },
      workspaceRoot,
      runId: "run-2",
    });

    assert.deepEqual(result, {
      status: "failed",
      message: "Requirement design contract failed.",
      files: [
        {
          path: "dist/sdlc/run-2/requirement_design_contract_result.json",
          role: "requirement_design_contract_result",
        },
      ],
      issues: [
        {
          severity: "high",
          message: "Missing required section.",
        },
      ],
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}
