import assert from "node:assert/strict";

import { McpToolRegistryService } from "../../src/Interface/Mcp/tool-registry.js";

export async function runMcpToolRegistryTests(): Promise<void> {
  await testListToolsContainsDocumentedToolSet();
  await testValidateArgumentsAcceptsMappedFields();
  await testValidateArgumentsRejectsUnknownFields();
  await testValidateArgumentsRejectsMissingRequiredFields();
}

async function testListToolsContainsDocumentedToolSet(): Promise<void> {
  const registry = new McpToolRegistryService();
  const tools = registry.listTools();

  assert.equal(tools.length, 15);
  assert.deepEqual(
    tools.map((entry) => entry.name),
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
