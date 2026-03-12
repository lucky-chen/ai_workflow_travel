import type { IStageGenerator, StageOutput, StageRunContext } from "../shared/contracts/pipeline.js";

export interface RequirementArtifacts {
  artifactKey: "requirement_document";
  content: string;
}

export class RequirementGenerator implements IStageGenerator<StageOutput<RequirementArtifacts>> {
  async run(context: StageRunContext): Promise<StageOutput<RequirementArtifacts>> {
    const content = context.inputArtifacts.requirement_document;
    if (!content) {
      throw new Error('Missing required input artifact "requirement_document".');
    }

    return {
      stageId: context.stageId,
      success: true,
      summary: "Requirement document loaded.",
      artifacts: {
        artifactKey: "requirement_document",
        content,
      },
    };
  }
}
