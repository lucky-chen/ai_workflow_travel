import { ImplementationGeneratorService } from "./implementation-generator-service.js";
// Public API: stage entry used by workflow runners to trigger implementation generation.
export class ImplementationGenerator {
    generator;
    constructor(dependencies) {
        this.generator = ImplementationGeneratorService.create(dependencies.artifactStore, dependencies.llmExecutor);
    }
    async run(context) {
        return this.generator.run(context);
    }
}
