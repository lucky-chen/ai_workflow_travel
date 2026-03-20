import type { RuntimeContext, RuntimeResult, UnitRuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { IArtifactStore } from "../../Data/artifact-store.js";
import type { ITraceRecorder } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { ILlmExecutor } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import { RuntimeUnitBase } from "../Shared/runtime-unit-base.js";
import { REQUIREMENT_DOCUMENT_PATH } from "./requirement-generator.js";

const REQUIREMENT_UPDATE_RESULT_PATH = "requirement_design_update_result.json";

function buildRequirementUpdatePrompt(userComment: string, existingRequirement?: string): string {
  const normalizedRequirement = existingRequirement?.trim() ?? "";
  const sections = [
    "Update the existing requirement markdown document.",
    "",
    "User request:",
    userComment,
  ];

  if (normalizedRequirement.length > 0) {
    sections.push(
      "",
      "Current requirement document:",
      normalizedRequirement,
    );
  }

  sections.push(
    "",
    "Return one markdown-only update instruction for an external editor.",
    "Keep the document aligned with the existing template structure and contract requirements.",
    "Do not apply the change directly.",
  );

  return sections.join("\n");
}

export class RequirementDesignUpdateRuntimeUnit extends RuntimeUnitBase {
  constructor(
    artifactStore: IArtifactStore,
    traceRecorder: ITraceRecorder,
    protected readonly llmExecutor: ILlmExecutor,
    resourceRoot?: string,
  ) {
    super(artifactStore, traceRecorder, resourceRoot);
  }

  async run(request: UnitRuntimeRequest, context: RuntimeContext): Promise<RuntimeResult> {
    const inputArtifacts = await this.readOptionalWorkspaceFile(
      context.workspaceRoot,
      REQUIREMENT_DOCUMENT_PATH,
      "requirement_design",
    );
    const userComment = request.params?.userComment?.trim();
    if (!userComment) {
      throw new Error('Missing required option: --user-comment');
    }

    const executionContext = this.buildExecutionContext(request, context, inputArtifacts);
    const prompt = buildRequirementUpdatePrompt(userComment, inputArtifacts.requirement_design);
    const targetPath = REQUIREMENT_DOCUMENT_PATH;
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
      REQUIREMENT_UPDATE_RESULT_PATH,
      JSON.stringify({ prompt, action: externalAction }, null, 2),
    );
    return {
      accepted: true,
      summary: `Requirement update prompt generated. Persisted to ${REQUIREMENT_UPDATE_RESULT_PATH}.`,
      externalAction,
    };
  }
}
