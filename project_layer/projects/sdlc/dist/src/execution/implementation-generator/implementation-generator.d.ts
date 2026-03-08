import type { IArtifactStore } from "../../shared/contracts/pipeline.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import type { IStageGenerator, ImplementationStageArtifacts, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
export interface ImplementationGeneratorDependencies {
    artifactStore: IArtifactStore;
    llmExecutor: ILlmExecutor;
}
export declare class ImplementationGenerator implements IStageGenerator<StageOutput<ImplementationStageArtifacts>> {
    private readonly generator;
    constructor(dependencies: ImplementationGeneratorDependencies);
    run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>>;
}
