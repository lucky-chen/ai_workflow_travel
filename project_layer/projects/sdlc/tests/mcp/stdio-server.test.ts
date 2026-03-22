import assert from "node:assert/strict";
import { DOCUMENTED_MCP_TOOL_NAMES } from "../../src/Interface/Mcp/tool-registry.js";
import { createMcpStdioClientHarness } from "./test-helpers.js";

export async function runMcpStdioServerTests(): Promise<void> {
  await runMcpStdioServerStartupTests();
  await runMcpStdioServerToolListTests();
  await runMcpStdioServerToolCallTests();
}

export async function runMcpStdioServerStartupTests(): Promise<void> {
  const harness = await startClient();

  try {
    const version = harness.client.getServerVersion();
    assert.deepEqual(version, {
      name: "sdlc-mcp",
      version: "0.1.0",
    });
  } finally {
    await harness.close();
  }
}

export async function runMcpStdioServerToolListTests(): Promise<void> {
  const harness = await startClient();

  try {
    const response = await harness.client.listTools();
    assert.equal(response.tools.length, DOCUMENTED_MCP_TOOL_NAMES.length);
    assert.deepEqual(
      response.tools.map((entry) => entry.name),
      DOCUMENTED_MCP_TOOL_NAMES,
    );
  } finally {
    await harness.close();
  }
}

export async function runMcpStdioServerToolCallTests(): Promise<void> {
  const harness = await startClient();

  try {
    const response = await harness.client.callTool({
      name: "requirement_design_update",
      arguments: {
        project_name: "hello-service",
        user_comment: "Add one operational note.",
      },
    }) as {
      content: Array<{ type: string; text?: string }>;
      structuredContent?: unknown;
      isError?: boolean;
    };

    assert.equal(response.isError, false);
    assert.equal(response.content[0]?.type, "text");
    const structured = response.structuredContent as {
      status: string;
      message: string;
      files?: Array<{ path: string; role: string }>;
      agentAction?: {
        actionType: string;
        targetPath: string;
        instructions: string;
      };
      externalAction?: unknown;
    };
    assert.equal(structured.status, "success");
    assert.equal(structured.files?.[0]?.path, "sdlc/docs/Requirement.md");
    assert.equal(structured.files?.[0]?.role, "requirement_design");
    assert.equal(structured.agentAction?.actionType, "update_markdown");
    assert.equal(structured.agentAction?.targetPath, "sdlc/docs/Requirement.md");
    assert.match(structured.agentAction?.instructions ?? "", /Add one operational note\./);
    assert.equal("externalAction" in structured, false);
  } finally {
    await harness.close();
  }
}

async function startClient() {
  return createMcpStdioClientHarness();
}
