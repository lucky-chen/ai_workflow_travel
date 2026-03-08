// Implementation generator service: orchestrates loading, prompting, execution, and output shaping.
import type { IArtifactStore } from "../../shared/contracts/artifact-store.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import type {
  IStageGenerator,
  ImplementationStageArtifacts,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import { ChangeApplier } from "./change-applier.js";
import { ImplementationPromptBuilder } from "./implementation-prompt-builder.js";
import { ModuleDesignLoader } from "./module-design-loader.js";
import { ProjectContextLoader } from "./project-context-loader.js";
import { StageOutputBuilder } from "./stage-output-builder.js";

export class ImplementationGeneratorService implements IStageGenerator {
  static create(
    artifactStore: IArtifactStore,
    llmExecutor: ILlmExecutor,
  ): IStageGenerator<StageOutput<ImplementationStageArtifacts>> {
    return new ImplementationGeneratorService(
      new ModuleDesignLoader(artifactStore),
      new ProjectContextLoader(),
      new ImplementationPromptBuilder(),
      llmExecutor,
      new ChangeApplier(),
      new StageOutputBuilder(),
    );
  }

  constructor(
    private readonly moduleDesignLoader: ModuleDesignLoader,
    private readonly projectContextLoader: ProjectContextLoader,
    private readonly promptBuilder: ImplementationPromptBuilder,
    private readonly llmExecutor: ILlmExecutor,
    private readonly changeApplier: ChangeApplier,
    private readonly outputBuilder: StageOutputBuilder,
  ) {}

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    const moduleDesignDoc = await this.moduleDesignLoader.loadModuleDesign(context);
    const projectContext = await this.projectContextLoader.loadProjectContext(context);
    const request = this.promptBuilder.build({ moduleDesignDoc, projectContext });
    const llmResult = await this.llmExecutor.execute(request);
    const generatedChanges = this.changeApplier.parseGeneratedChanges(llmResult);
    return this.outputBuilder.build(context.stageId, generatedChanges);
  }
}
