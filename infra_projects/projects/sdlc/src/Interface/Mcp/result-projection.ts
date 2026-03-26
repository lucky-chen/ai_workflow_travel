import { readFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeResult } from "../../Runtime/Schema/runtime.js";
import type { CapabilityToolArguments, McpAgentResult } from "./types.js";
import type { RegisteredMcpTool } from "./tool-registry.js";

interface ProjectionInput {
  tool: RegisteredMcpTool;
  args: CapabilityToolArguments;
  runtimeResult: RuntimeResult;
  workspaceRoot: string;
  runId: string;
}

interface ContractArtifact {
  passed?: boolean;
  summary?: string;
  issues?: Array<{
    severity?: "low" | "medium" | "high";
    message: string;
  }>;
}

const CONTRACT_RESULT_FILES: Record<string, string> = {
  requirement_design_contract: "requirement_design_contract_result.json",
  architecture_design_contract: "architecture_design_contract_result.json",
  item_design_contract: "item_design_contract_result.json",
  work_plan_contract: "work_plan_contract_result.json",
  overall_design_contract: "overall_design_contract_result.json",
  work_execute_contract: "work_execute_contract_result.json",
};

export async function projectRuntimeResultToMcp(
  input: ProjectionInput,
): Promise<McpAgentResult> {
  const contractArtifact = await loadContractArtifact(input);
  const files = await buildFiles(input);
  const agentAction = buildAgentAction(input.runtimeResult);
  const message = contractArtifact?.summary?.trim() || input.runtimeResult.summary;
  const status = contractArtifact
    ? contractArtifact.passed === false ? "failed" : input.runtimeResult.accepted ? "success" : "failed"
    : input.runtimeResult.accepted ? "success" : "failed";

  return {
    status,
    message,
    ...(files.length > 0 ? { files } : {}),
    ...(contractArtifact?.issues && contractArtifact.issues.length > 0 ? { issues: contractArtifact.issues } : {}),
    ...(agentAction ? { agentAction } : {}),
  };
}

async function buildFiles(input: ProjectionInput): Promise<NonNullable<McpAgentResult["files"]>> {
  const executionUnitId = input.tool.executionUnitId;

  if (executionUnitId === "requirement_design_generate") {
    return [{ path: "sdlc/docs/Requirement.md", role: "requirement_design" }];
  }
  if (executionUnitId === "architecture_design_generate") {
    return [{ path: "sdlc/docs/TechnicalArchitecture.md", role: "architecture_design" }];
  }
  if (executionUnitId === "item_design_generate") {
    return [await buildItemDesignFile(input)];
  }
  if (executionUnitId === "work_plan_generate") {
    return [{ path: "sdlc/docs/work_plan.yaml", role: "work_plan" }];
  }
  if (executionUnitId.endsWith("_update") && input.runtimeResult.externalAction) {
    const targetArtifact = readTargetArtifact(input.runtimeResult.externalAction.payload);
    return targetArtifact ? [{ path: targetArtifact.filePath, role: targetArtifact.artifactKey }] : [];
  }
  if (executionUnitId in CONTRACT_RESULT_FILES) {
    return [{
      path: path.join("dist", "sdlc", input.runId, CONTRACT_RESULT_FILES[executionUnitId]!),
      role: buildContractRole(executionUnitId),
    }];
  }

  return [];
}

async function buildItemDesignFile(
  input: ProjectionInput,
): Promise<{ path: string; role: string }> {
  const descriptorPath = input.args.item_descriptor_path;
  if (!descriptorPath) {
    throw new Error("Item design MCP projection requires item_descriptor_path.");
  }

  const descriptor = JSON.parse(
    await readFile(path.join(input.workspaceRoot, descriptorPath), "utf8"),
  ) as { name?: string; documentPath?: string };
  const itemName = descriptor.name?.trim();
  const documentPath = descriptor.documentPath?.trim();
  if (!itemName || !documentPath) {
    throw new Error("Item descriptor must include name and documentPath for MCP projection.");
  }

  return {
    path: documentPath,
    role: `${itemName}_design`,
  };
}

function buildContractRole(executionUnitId: string): string {
  if (executionUnitId === "requirement_design_contract") {
    return "requirement_design_contract_result";
  }
  if (executionUnitId === "architecture_design_contract") {
    return "architecture_design_contract_result";
  }
  if (executionUnitId === "item_design_contract") {
    return "item_design_contract_result";
  }
  if (executionUnitId === "work_plan_contract") {
    return "work_plan_contract_result";
  }
  if (executionUnitId === "overall_design_contract") {
    return "overall_design_contract_result";
  }
  return "work_execute_contract_result";
}

function buildAgentAction(runtimeResult: RuntimeResult): McpAgentResult["agentAction"] {
  const action = runtimeResult.externalAction;
  if (!action) {
    return undefined;
  }

  const prompt = action.payload && typeof action.payload === "object"
    ? (action.payload as Record<string, unknown>).prompt
    : undefined;
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new Error("Unable to project MCP agentAction: externalAction.payload.prompt must be a non-empty string.");
  }

  return {
    actionType: action.operation,
    targetPath: action.targetPath,
    instructions: prompt,
  };
}

function readTargetArtifact(payload: unknown): { artifactKey: string; filePath: string } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const targetArtifact = (payload as { targetArtifact?: { artifactKey?: unknown; filePath?: unknown } }).targetArtifact;
  if (!targetArtifact || typeof targetArtifact !== "object") {
    return null;
  }

  if (typeof targetArtifact.artifactKey !== "string" || typeof targetArtifact.filePath !== "string") {
    return null;
  }

  return {
    artifactKey: targetArtifact.artifactKey,
    filePath: targetArtifact.filePath,
  };
}

async function loadContractArtifact(input: ProjectionInput): Promise<ContractArtifact | undefined> {
  const fileName = CONTRACT_RESULT_FILES[input.tool.executionUnitId];
  if (!fileName) {
    return undefined;
  }

  const artifactPath = path.join(input.workspaceRoot, "dist", "sdlc", input.runId, fileName);
  const raw = await readFile(artifactPath, "utf8");
  return JSON.parse(raw) as ContractArtifact;
}
