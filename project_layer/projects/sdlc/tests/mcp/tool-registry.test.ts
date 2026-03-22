import assert from "node:assert/strict";

import { DOCUMENTED_MCP_TOOL_NAMES, McpToolRegistryService } from "../../src/Interface/Mcp/tool-registry.js";

export async function runMcpToolRegistryTests(): Promise<void> {
  await testListToolsContainsDocumentedToolSet();
  await testValidateArgumentsAcceptsMappedFields();
  await testValidateArgumentsRejectsUnknownFields();
  await testValidateArgumentsRejectsMissingRequiredFields();
}

async function testListToolsContainsDocumentedToolSet(): Promise<void> {
  const registry = new McpToolRegistryService();
  const tools = registry.listTools();

  assert.equal(tools.length, DOCUMENTED_MCP_TOOL_NAMES.length);
  assert.deepEqual(
    tools.map((entry) => entry.name),
    DOCUMENTED_MCP_TOOL_NAMES,
  );
  assert.deepEqual(
    registry.getTool("work_execute_contract").inputSchema.required,
    ["test_command"],
  );
}

async function testValidateArgumentsAcceptsMappedFields(): Promise<void> {
  const registry = new McpToolRegistryService();
  const args = registry.validateArguments("item_design_update", {
    project_name: "hello-service",
    user_comment: "Refine item design",
    item_descriptor_path: "tmp/EchoService.json",
  });

  assert.deepEqual(args, {
    project_name: "hello-service",
    user_comment: "Refine item design",
    item_descriptor_path: "tmp/EchoService.json",
  });
}

async function testValidateArgumentsRejectsUnknownFields(): Promise<void> {
  const registry = new McpToolRegistryService();

  assert.throws(
    () => registry.validateArguments("requirement_design_generate", {
      test_command: "node -e \"process.exit(0)\"",
    }),
    /Invalid MCP argument for requirement_design_generate: test_command/,
  );
}

async function testValidateArgumentsRejectsMissingRequiredFields(): Promise<void> {
  const registry = new McpToolRegistryService();

  assert.throws(
    () => registry.validateArguments("work_execute_contract", {
      project_name: "hello-service",
    }),
    /Missing required MCP argument for work_execute_contract: test_command/,
  );
}
