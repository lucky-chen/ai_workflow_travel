export class LaunchValidator {
    validate(request, registry) {
        if (!registry.has(request.startStageId)) {
            throw new Error(`No stage definition registered for startStageId "${request.startStageId}".`);
        }
        const definition = registry.get(request.startStageId);
        for (const requiredArtifact of definition.launchRequirements) {
            if (!(requiredArtifact in request.inputArtifacts)) {
                throw new Error(`Missing required input artifact "${requiredArtifact}" for stage "${request.startStageId}".`);
            }
        }
    }
}
