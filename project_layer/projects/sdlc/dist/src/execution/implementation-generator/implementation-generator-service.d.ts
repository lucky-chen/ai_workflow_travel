import type { IArtifactStore } from "../../shared/contracts/pipeline.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import type { IStageGenerator, ImplementationStageArtifacts, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import { ChangeApplier } from "./change-applier.js";
import { ImplementationPromptBuilder } from "./implementation-prompt-builder.js";
import { ModuleDesignLoader } from "./module-design-loader.js";
import { ProjectContextLoader } from "./project-context-loader.js";
import { StageOutputBuilder } from "./stage-output-builder.js";
export declare class ImplementationGeneratorService implements IStageGenerator {
    private readonly moduleDesignLoader;
    private readonly projectContextLoader;
    private readonly promptBuilder;
    private readonly llmExecutor;
    private readonly changeApplier;
    private readonly outputBuilder;
    static create(artifactStore: IArtifactStore, llmExecutor: ILlmExecutor): IStageGenerator<StageOutput<ImplementationStageArtifacts>>;
    constructor(moduleDesignLoader: ModuleDesignLoader, projectContextLoader: ProjectContextLoader, promptBuilder: ImplementationPromptBuilder, llmExecutor: ILlmExecutor, changeApplier: ChangeApplier, outputBuilder: StageOutputBuilder);
    run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>>;
}
