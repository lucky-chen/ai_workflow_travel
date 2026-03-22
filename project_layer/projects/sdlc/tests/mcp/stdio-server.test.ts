import assert from "node:assert/strict";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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
    assert.equal(response.tools.length, 15);
    assert.deepEqual(
      response.tools.map((entry) => entry.name),
      [
        "requirement_design_generate",
        "architecture_design_generate",
        "item_design_generate",
        "work_plan_generate",
        "requirement_design_update",
        "architecture_design_update",
        "item_design_update",
        "work_plan_update",
        "requirement_design_contract",
        "architecture_design_contract",
        "item_design_contract",
        "work_plan_contract",
        "overall_design_contract",
        "work_execute",
        "work_execute_contract",
      ],
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

async function startClient(): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(process.cwd(), "bin", "sdlc-mcp.js")],
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
    stderr: "pipe",
  });
  const client = new Client({
    name: "sdlc-mcp-test-client",
    version: "0.1.0",
  });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}
