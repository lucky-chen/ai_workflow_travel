import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { WorkPlanContract } from "./work-plan-contract.js";
import { WorkPlanGenerator } from "./work-plan-generator.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
const ITEM_DESIGN_DIRECTORY = "sdlc/docs/item_design";
const WORK_PLAN_PATH = "sdlc/docs/work_plan.yaml";
const WORK_PLAN_CONTRACT_RESULT_PATH = "work_plan_contract_result.json";
const WORK_PLAN_UPDATE_RESULT_PATH = "work_plan_update_result.json";

function buildWorkPlanUpdatePrompt(
  requirementDocument: string,
  architectureDocument: string,
  itemDesignDocuments: string[],
  currentWorkPlanDocument?: string,
): string {
  const normalizedRequirement = requirementDocument.trim();
  const normalizedArchitecture = architectureDocument.trim();
  const normalizedCurrentPlan = currentWorkPlanDocument?.trim() ?? "";
  const sections = [
    "Update the existing work plan yaml document.",
    "",
    "Requirement document:",
    normalizedRequirement,
    "",
    "Architecture document:",
    normalizedArchitecture,
    "",
    "Item design documents:",
    JSON.stringify(itemDesignDocuments, null, 2),
  ];

  if (normalizedCurrentPlan.length > 0) {
    sections.push(
      "",
      "Current work plan document:",
      normalizedCurrentPlan,
    );
  }

  sections.push(
    "",
    "Return one yaml-oriented update instruction for an external editor.",
    "Keep the work plan aligned with the requirement document, architecture document, item design documents, template structure, and contract requirements.",
    "Do not apply the change directly.",
  );

  return sections.join("\n");
}

abstract class WorkPlanRuntimeUnitBase extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  protected async loadWorkPlanInputArtifacts(workspaceRoot: string): Promise<Record<string, string>> {
    return {
      requirement_design: await this.readRequiredWorkspaceFile(workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      architecture_design: await this.readRequiredWorkspaceFile(workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      item_design_documents: JSON.stringify(await this.loadItemDesignDocuments(workspaceRoot)),
    };
  }

  protected async loadItemDesignDocuments(workspaceRoot: string): Promise<string[]> {
    const directoryPath = path.join(workspaceRoot, ITEM_DESIGN_DIRECTORY);
    const fileNames = await readdir(directoryPath);
    const markdownFiles = fileNames.filter((entry) => entry.endsWith(".md")).sort();

    if (markdownFiles.length === 0) {
      throw new Error(`Missing required item design documents under "${ITEM_DESIGN_DIRECTORY}".`);
    }

    return Promise.all(
      markdownFiles.map(async (fileName) => readFile(path.join(directoryPath, fileName), "utf8")),
    );
  }

  protected async runGenerator(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const executionContext = this.buildExecutionContext(request, context, await this.loadWorkPlanInputArtifacts(context.workspaceRoot));
    const output = await new WorkPlanGenerator({
      llmExecutor: this.llmExecutor,
      traceRecorder: this.traceRecorder,
    }).run(executionContext);
    const artifacts = output.artifacts as Record<string, unknown>;
    await this.writeWorkspaceFile(context.workspaceRoot, WORK_PLAN_PATH, this.readStringField(artifacts, "content"));
    return {
      accepted: true,
      summary: `${output.summary} Persisted to ${WORK_PLAN_PATH}.`,
    };
  }
}

export class WorkPlanGenerateRuntimeUnit extends WorkPlanRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    return this.runGenerator(request, context);
  }
}

export class WorkPlanUpdateRuntimeUnit extends WorkPlanRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const inputArtifacts: Record<string, string> = {
      ...(await this.loadWorkPlanInputArtifacts(context.workspaceRoot)),
      ...(await this.readOptionalWorkspaceFile(context.workspaceRoot, WORK_PLAN_PATH, "work_plan")),
    };
    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const itemDesignDocuments = JSON.parse(inputArtifacts.item_design_documents) as string[];
    const prompt = buildWorkPlanUpdatePrompt(
      inputArtifacts.requirement_design,
      inputArtifacts.architecture_design,
      itemDesignDocuments,
      inputArtifacts.work_plan,
    );
    const targetPath = WORK_PLAN_PATH;
    const externalAction = {
      tool: "external_plugin" as const,
      operation: "update_markdown",
      targetPath,
      payload: {
        prompt,
      },
    };
    await this.writeArtifact(
      executionContext,
      WORK_PLAN_UPDATE_RESULT_PATH,
      JSON.stringify({ prompt, action: externalAction }, null, 2),
    );
    return {
      accepted: true,
      summary: `Work plan update prompt generated. Persisted to ${WORK_PLAN_UPDATE_RESULT_PATH}.`,
      externalAction,
    };
  }
}

export class WorkPlanContractRuntimeUnit extends WorkPlanRuntimeUnitBase {
  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const executionContext = this.buildExecutionContext(request, context, await this.loadWorkPlanInputArtifacts(context.workspaceRoot));
    const output = {
      executionUnitId: "work_plan",
      success: true,
      summary: "Loaded work plan artifact for contract check.",
      artifacts: {
        artifactKey: "work_plan",
        content: await this.readRequiredWorkspaceFile(context.workspaceRoot, WORK_PLAN_PATH),
      },
    };
    const result = await new WorkPlanContract(this.llmExecutor).check(executionContext, output);
    await this.writeArtifact(executionContext, WORK_PLAN_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
    return {
      accepted: true,
      summary: `${result.summary} Persisted to ${WORK_PLAN_CONTRACT_RESULT_PATH}.`,
    };
  }
}
