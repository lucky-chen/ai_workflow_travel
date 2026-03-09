import type { ArtifactMap } from "../../shared/types/common.js";
import type { PreparedStepContext } from "./types.js";

export class ExecutionContextLoader {
  load(inputArtifacts: ArtifactMap): PreparedStepContext {
    const rawPreparedStepContext = inputArtifacts.prepared_step_context;
    if (!rawPreparedStepContext) {
      throw new Error('Missing required input artifact "prepared_step_context".');
    }

    let preparedStepContext: unknown;
    try {
      preparedStepContext = JSON.parse(rawPreparedStepContext);
    } catch {
      throw new Error('Input artifact "prepared_step_context" must be valid JSON.');
    }

    if (!this.isPreparedStepContext(preparedStepContext)) {
      throw new Error('Input artifact "prepared_step_context" has an invalid structure.');
    }

    return preparedStepContext;
  }

  private isPreparedStepContext(value: unknown): value is PreparedStepContext {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<PreparedStepContext>;
    return Boolean(
      candidate.workplan
      && typeof candidate.workplan.ref === "string"
      && candidate.workplan.ref.length > 0
      && typeof candidate.workplan.content === "string"
      && candidate.workplan.content.length > 0
      && candidate.currentStep
      && typeof candidate.currentStep.stepId === "string"
      && candidate.currentStep.stepId.length > 0
      && typeof candidate.currentStep.raw === "string"
      && candidate.currentStep.raw.length > 0
      && candidate.upstreamContext
      && typeof candidate.upstreamContext.requirementDocument === "string"
      && candidate.upstreamContext.requirementDocument.length > 0
      && typeof candidate.upstreamContext.architectureDocument === "string"
      && candidate.upstreamContext.architectureDocument.length > 0
      && Array.isArray(candidate.upstreamContext.moduleDesignDocuments)
      && candidate.upstreamContext.moduleDesignDocuments.length > 0
      && candidate.upstreamContext.moduleDesignDocuments.every(
        (entry) => entry
          && typeof entry.moduleName === "string"
          && entry.moduleName.length > 0
          && typeof entry.content === "string"
          && entry.content.length > 0,
      )
    );
  }
}
