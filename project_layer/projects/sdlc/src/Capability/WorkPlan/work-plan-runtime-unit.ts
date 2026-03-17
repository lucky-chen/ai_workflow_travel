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

export class WorkPlanRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    private readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    if (request.executionUnitId === "work_plan_contract") {
      return this.runContract(request, context);
    }

    return this.runGenerate(request, context);
  }

  private async runContract(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
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
    const result = await new WorkPlanContract().check(executionContext, output);
    await this.writeArtifact(executionContext, WORK_PLAN_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
    return {
      accepted: true,
      summary: `${result.summary} Persisted to ${WORK_PLAN_CONTRACT_RESULT_PATH}.`,
    };
  }

  private async runGenerate(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
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

  private async loadWorkPlanInputArtifacts(workspaceRoot: string): Promise<Record<string, string>> {
    return {
      requirement_design: await this.readRequiredWorkspaceFile(workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      architecture_design: await this.readRequiredWorkspaceFile(workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      item_design_documents: JSON.stringify(await this.loadItemDesignDocuments(workspaceRoot)),
    };
  }

  private async loadItemDesignDocuments(workspaceRoot: string): Promise<string[]> {
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
}
