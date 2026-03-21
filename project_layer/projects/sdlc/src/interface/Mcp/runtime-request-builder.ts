import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type { RuntimeInput, StringMap } from "../../Runtime/Schema/runtime.js";
import type { CapabilityToolArguments } from "./types.js";
import type { RegisteredMcpTool } from "./tool-registry.js";
import type { WorkPlan, WorkPlanBatch } from "../../Runtime/Schema/work-plan.js";

interface ArchitectureBreakdownEntry {
  targetName?: string;
  name?: string;
  documentPath?: string;
}

interface PreparedStepContext {
  workplanRef: string;
  workplan: WorkPlan;
  currentBatch: WorkPlanBatch;
  upstreamContext: {
    requirementDocument: string;
    architectureDocument: string;
    itemDesignDocuments: Array<{
      itemName: string;
      content: string;
    }>;
  };
}

const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
const WORK_PLAN_DOCUMENT_PATH = "sdlc/docs/work_plan.yaml";
const ITEM_BREAKDOWN_PATH = "sdlc/docs/architecture_design_breakdown.json";

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

async function resolvePrimaryItemDocumentPath(workspaceRoot: string): Promise<string> {
  const breakdownEntries = await readArchitectureBreakdown(workspaceRoot);
  const firstEntry = breakdownEntries.find((entry) => typeof entry.documentPath === "string" && entry.documentPath.length > 0);
  if (firstEntry?.documentPath) {
    return firstEntry.documentPath;
  }

  const itemDesignDirectory = path.join(workspaceRoot, "sdlc", "docs", "item_design");
  const entries = await readdir(itemDesignDirectory, { withFileTypes: true });
  const firstDocument = entries.find((entry) => entry.isFile() && entry.name.endsWith(".md"));
  if (firstDocument) {
    return path.join("sdlc", "docs", "item_design", firstDocument.name);
  }

  throw new Error("Unable to resolve primary item design document for MCP item_design_contract.");
}

async function writePreparedStepContext(workspaceRoot: string, runId: string): Promise<string> {
  const preparedStepContext = await buildPreparedStepContext(workspaceRoot);
  const relativePath = path.join("dist", "sdlc", runId, "prepared-step-context.json");
  const absolutePath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, JSON.stringify(preparedStepContext, null, 2), "utf8");
  return relativePath;
}

async function buildPreparedStepContext(workspaceRoot: string): Promise<PreparedStepContext> {
  const requirementDocument = await readFile(path.join(workspaceRoot, REQUIREMENT_DOCUMENT_PATH), "utf8");
  const architectureDocument = await readFile(path.join(workspaceRoot, ARCHITECTURE_DOCUMENT_PATH), "utf8");
  const itemDesignDocuments = await loadItemDesignDocuments(workspaceRoot);
  const workplan = await readWorkPlan(workspaceRoot, itemDesignDocuments);
  const currentStep = workplan.steps[0];
  const currentBatch = currentStep?.batches[0];

  if (!currentStep || !currentBatch) {
    throw new Error("Unable to build prepared step context: work plan must contain at least one step and one batch.");
  }

  return {
    workplanRef: `${WORK_PLAN_DOCUMENT_PATH}#${currentStep.stepId}.${currentBatch.batchId}`,
    workplan,
    currentBatch,
    upstreamContext: {
      requirementDocument,
      architectureDocument,
      itemDesignDocuments,
    },
  };
}

async function readWorkPlan(
  workspaceRoot: string,
  itemDesignDocuments: Array<{ itemName: string; content: string }>,
): Promise<WorkPlan> {
  const raw = await readFile(path.join(workspaceRoot, WORK_PLAN_DOCUMENT_PATH), "utf8");
  const parsed = parseYaml(raw) as { steps?: WorkPlan["steps"] };
  if (parsed?.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
    return {
      steps: parsed.steps,
    };
  }

  return {
    steps: [
      {
        stepId: "step-1",
        title: `${itemDesignDocuments[0]?.itemName ?? "Workspace"} baseline`,
        status: "not_started",
        architectureModulesInScope: itemDesignDocuments.map((entry) => entry.itemName),
        batches: [
          {
            batchId: "batch-1",
            title: "Apply approved workspace change",
            status: "not_started",
            tasks: [
              "apply the approved workspace change through the external execution path",
            ],
          },
        ],
      },
    ],
  };
}

async function loadItemDesignDocuments(
  workspaceRoot: string,
): Promise<Array<{ itemName: string; content: string }>> {
  const breakdownEntries = await readArchitectureBreakdown(workspaceRoot);
  const results = await Promise.all(
    breakdownEntries
      .filter((entry) => typeof entry.documentPath === "string" && entry.documentPath.length > 0)
      .map(async (entry) => ({
        itemName: entry.targetName ?? entry.name ?? path.basename(entry.documentPath!, ".md"),
        content: await readFile(path.join(workspaceRoot, entry.documentPath!), "utf8"),
      })),
  );

  if (results.length === 0) {
    throw new Error("Unable to build prepared step context: no item design documents are available.");
  }

  return results;
}

async function readArchitectureBreakdown(workspaceRoot: string): Promise<ArchitectureBreakdownEntry[]> {
  const raw = await readFile(path.join(workspaceRoot, ITEM_BREAKDOWN_PATH), "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Architecture design breakdown must be a JSON array.");
  }

  return parsed as ArchitectureBreakdownEntry[];
}
