import { readdir } from "node:fs/promises";
import path from "node:path";

import { OverallDesignContract } from "./overall-design-contract.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";

const REQUIREMENT_DOCUMENT_PATH = "sdlc/docs/Requirement.md";
const ARCHITECTURE_DOCUMENT_PATH = "sdlc/docs/TechnicalArchitecture.md";
const ARCHITECTURE_BREAKDOWN_PATH = "sdlc/docs/architecture_design_breakdown.json";
const ITEM_DESIGN_DIRECTORY_PATH = "sdlc/docs/item_design";
const OVERALL_DESIGN_CONTRACT_RESULT_PATH = "overall_design_contract_result.json";

export class OverallDesignContractRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
  ) {
    super(artifactStore, traceRecorder);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const inputArtifacts = await this.loadInputArtifacts(context.workspaceRoot);
    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const output = {
      executionUnitId: "overall_design_contract",
      success: true,
      summary: "Loaded overall design artifacts for contract check.",
      artifacts: inputArtifacts,
    };
    const result = await new OverallDesignContract().check(executionContext, output);
    await this.writeArtifact(executionContext, OVERALL_DESIGN_CONTRACT_RESULT_PATH, JSON.stringify(result, null, 2));
    return {
      accepted: true,
      summary: `${result.summary} Persisted to ${OVERALL_DESIGN_CONTRACT_RESULT_PATH}.`,
    };
  }

  private async loadInputArtifacts(workspaceRoot: string): Promise<Record<string, string>> {
    const itemDesignDocuments = await this.loadItemDesignDocuments(workspaceRoot);
    return {
      requirement_design: await this.readRequiredWorkspaceFile(workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      architecture_design: await this.readRequiredWorkspaceFile(workspaceRoot, ARCHITECTURE_DOCUMENT_PATH),
      item_design_documents: JSON.stringify(itemDesignDocuments),
      ...(await this.readOptionalWorkspaceFile(
        workspaceRoot,
        ARCHITECTURE_BREAKDOWN_PATH,
        "architecture_design_breakdown",
      )),
    };
  }

  private async loadItemDesignDocuments(workspaceRoot: string): Promise<Array<{ path: string; content: string }>> {
    const itemDesignDirectory = path.join(workspaceRoot, ITEM_DESIGN_DIRECTORY_PATH);
    const entries = await readdir(itemDesignDirectory, { withFileTypes: true });
    const markdownFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .sort((left, right) => left.name.localeCompare(right.name));

    return Promise.all(
      markdownFiles.map(async (entry) => ({
        path: path.posix.join(ITEM_DESIGN_DIRECTORY_PATH, entry.name),
        content: await this.readRequiredWorkspaceFile(
          workspaceRoot,
          path.posix.join(ITEM_DESIGN_DIRECTORY_PATH, entry.name),
        ),
      })),
    );
  }
}
