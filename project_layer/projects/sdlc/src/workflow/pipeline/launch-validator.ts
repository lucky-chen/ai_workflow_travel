import type { LaunchTaskRequest } from "../../shared/contracts/pipeline.js";
import { hasArtifactValue } from "../../shared/contracts/pipeline.js";
import { StageRegistry } from "./stage-registry.js";

export class LaunchValidator {
  validate(request: LaunchTaskRequest, registry: StageRegistry): void {
    if (!registry.has(request.startStageId)) {
      throw new Error(`No stage definition registered for startStageId "${request.startStageId}".`);
    }

    const definition = registry.get(request.startStageId);
    for (const requiredArtifact of definition.launchRequirements) {
      if (!hasArtifactValue(request.inputArtifacts, requiredArtifact)) {
        throw new Error(
          `Missing required input artifact "${requiredArtifact}" for stage "${request.startStageId}".`,
        );
      }
    }
  }
}
