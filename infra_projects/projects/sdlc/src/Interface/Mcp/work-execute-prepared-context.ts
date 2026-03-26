import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type { WorkPlan, WorkPlanBatch } from "../../Runtime/Schema/work-plan.js";
import { loadItemDesignDocuments } from "./item-design-resolution.js";

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

export async function writePreparedStepContext(workspaceRoot: string, runId: string): Promise<string> {
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
