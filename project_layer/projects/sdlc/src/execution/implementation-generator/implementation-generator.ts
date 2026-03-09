// Implementation generator module: public entry for implementation generation.
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import type {
  IStageGenerator,
  ImplementationStageArtifacts,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import { ImplementationGeneratorService } from "./implementation-generator-service.js";

export interface ImplementationGeneratorDependencies {
  llmExecutor: ILlmExecutor;
}

// Public API: stage entry used by workflow runners to trigger implementation generation.
export class ImplementationGenerator implements IStageGenerator<StageOutput<ImplementationStageArtifacts>> {
  private readonly generator: IStageGenerator<StageOutput<ImplementationStageArtifacts>>;

  constructor(dependencies: ImplementationGeneratorDependencies) {
    this.generator = ImplementationGeneratorService.create(
      dependencies.llmExecutor,
    );
  }

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    return this.generator.run(context);
  }
}
