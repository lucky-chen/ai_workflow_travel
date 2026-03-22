import type { RuntimeInput, StringMap } from "../../Runtime/Schema/runtime.js";
import type { CapabilityToolArguments } from "./types.js";
import type { RegisteredMcpTool } from "./tool-registry.js";
import { resolvePrimaryItemDocumentPath } from "./item-design-resolution.js";
import { writePreparedStepContext } from "./work-execute-prepared-context.js";

export async function buildMcpRuntimeInput(
  tool: RegisteredMcpTool,
  args: CapabilityToolArguments,
  workspaceRoot: string,
  runId: string,
): Promise<RuntimeInput> {
  return {
    request: {
      mode: "unit",
      executionUnitId: tool.executionUnitId,
      params: await buildRuntimeParams(tool, args, workspaceRoot, runId),
    },
    context: {
      workspaceRoot,
      runId,
    },
  };
}

async function buildRuntimeParams(
  tool: RegisteredMcpTool,
  args: CapabilityToolArguments,
  workspaceRoot: string,
  runId: string,
): Promise<StringMap | undefined> {
  const params: Record<string, string> = {};

  if (args.user_comment) {
    params.userComment = args.user_comment;
  }
  if (args.item_descriptor_path) {
    params.itemDescriptorPath = args.item_descriptor_path;
  }
  if (args.test_command) {
    params.testCommand = args.test_command;
  }

  if (tool.executionUnitId === "item_design_contract") {
    params.documentPath = await resolvePrimaryItemDocumentPath(workspaceRoot);
  }

  if (tool.executionUnitId === "work_execute") {
    params.preparedStepContextPath = await writePreparedStepContext(workspaceRoot, runId);
  }

  return Object.keys(params).length > 0 ? params : undefined;
}
