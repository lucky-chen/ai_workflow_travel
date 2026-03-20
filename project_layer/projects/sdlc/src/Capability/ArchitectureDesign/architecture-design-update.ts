import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import {
  ARCHITECTURE_DOCUMENT_PATH,
  REQUIREMENT_DOCUMENT_PATH,
} from "./architecture-design-generator.js";

const ARCHITECTURE_UPDATE_RESULT_PATH = "architecture_design_update_result.json";

function buildArchitectureUpdatePrompt(
  requirementDocument: string,
  currentArchitectureDocument?: string,
): string {
  const normalizedRequirement = requirementDocument.trim();
  const normalizedArchitecture = currentArchitectureDocument?.trim() ?? "";
  const sections = [
    "Update the existing technical architecture markdown document.",
    "",
    "Requirement document:",
    normalizedRequirement,
  ];

  if (normalizedArchitecture.length > 0) {
    sections.push(
      "",
      "Current architecture document:",
      normalizedArchitecture,
    );
  }

  sections.push(
    "",
    "Return one markdown-only update instruction for an external editor.",
    "Keep the architecture aligned with the requirement document, template structure, and contract requirements.",
    "Do not apply the change directly.",
  );

  return sections.join("\n");
}

export class ArchitectureDesignUpdateRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const inputArtifacts: Record<string, string> = {
      requirement_design: await this.readRequiredWorkspaceFile(context.workspaceRoot, REQUIREMENT_DOCUMENT_PATH),
      ...(await this.readOptionalWorkspaceFile(context.workspaceRoot, ARCHITECTURE_DOCUMENT_PATH, "architecture_design")),
    };
    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const prompt = buildArchitectureUpdatePrompt(
      inputArtifacts.requirement_design,
      inputArtifacts.architecture_design,
    );
    const targetPath = ARCHITECTURE_DOCUMENT_PATH;
    const externalAction = {
      tool: "external_plugin" as const,
      operation: "update_markdown",
      targetPath,
      payload: {
        handoffType: "document_update" as const,
        prompt,
        targetArtifact: {
          artifactKey: "architecture_design",
          filePath: targetPath,
        },
      },
    };
    await this.writeArtifact(
      executionContext,
      ARCHITECTURE_UPDATE_RESULT_PATH,
      JSON.stringify({ prompt, action: externalAction }, null, 2),
    );
    return {
      accepted: true,
      summary: `Architecture update prompt generated. Persisted to ${ARCHITECTURE_UPDATE_RESULT_PATH}.`,
      externalAction,
    };
  }
}
