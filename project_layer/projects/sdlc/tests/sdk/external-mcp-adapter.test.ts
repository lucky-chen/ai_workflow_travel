import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ExternalMcpAdapterService } from "../../src/SDK/ExternalMcp/external-mcp-adapter.js";
import type { ILlmExecutor } from "../../src/SDK/AgentRuntime/LlmExecutor/llm-executor.js";

export async function runExternalMcpAdapterTests(): Promise<void> {
  await testExternalMcpAdapterExecutesDocumentUpdate();
  await testExternalMcpAdapterRejectsUnsupportedAction();
}

async function testExternalMcpAdapterExecutesDocumentUpdate(): Promise<void> {
  const workspaceRoot = await createTempDir("external-mcp-adapter-workspace-");

  try {
    await mkdir(path.join(workspaceRoot, "sdlc", "docs"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "# Old Requirement\n", "utf8");

    const adapter = new ExternalMcpAdapterService({
      async execute() {
        return {
          content: "# Updated Requirement\n\n- updated by external mcp adapter\n",
          responseFormat: "text",
        };
      },
    });

    const result = await adapter.execute(
      {
        tool: "external_plugin",
        operation: "update_markdown",
        targetPath: "sdlc/docs/Requirement.md",
        payload: {
          handoffType: "document_update",
          prompt: "Update the requirement document.",
          targetArtifact: {
            artifactKey: "requirement_design",
            filePath: "sdlc/docs/Requirement.md",
          },
        },
      },
      {
        workspaceRoot,
      },
    );

    assert.deepEqual(result, {
      status: "success",
      targetPath: workspaceRoot,
      changedFiles: [
        {
          path: "sdlc/docs/Requirement.md",
          operation: "update",
          content: "# Updated Requirement\n\n- updated by external mcp adapter",
        },
      ],
      updatedArtifacts: [
        {
          artifactKey: "requirement_design",
          filePath: "sdlc/docs/Requirement.md",
          content: "# Updated Requirement\n\n- updated by external mcp adapter",
        },
      ],
      resumeInput: {
        requirement_design: "# Updated Requirement\n\n- updated by external mcp adapter",
      },
    });
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8"),
      "# Updated Requirement\n\n- updated by external mcp adapter",
    );
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testExternalMcpAdapterRejectsUnsupportedAction(): Promise<void> {
  const adapter = new ExternalMcpAdapterService(createUnusedLlmExecutor());

  await assert.rejects(
    () => adapter.execute(
      {
        tool: "external_execution",
        operation: "apply_workspace_change",
        targetPath: "/tmp/workspace",
      },
      {
        workspaceRoot: "/tmp/workspace",
      },
    ),
    /Unsupported external mcp action/,
  );
}

function createUnusedLlmExecutor(): ILlmExecutor {
  return {
    async execute() {
      throw new Error("execute should not be called");
    },
  };
}

async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

async function removeTempDir(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}
