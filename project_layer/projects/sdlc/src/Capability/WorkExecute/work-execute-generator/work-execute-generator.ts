// Work-execute generator module: public entry for work execution generation.
import type { ILlmExecutor } from "../../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type {
  IExecutionUnitGenerator,
  WorkExecuteArtifacts,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../../Runtime/Unit/execution-unit.js";
import { WorkExecuteService } from "./work-execute-service.js";

export interface WorkExecuteGeneratorDependencies {
  llmExecutor: ILlmExecutor;
}

// Public API: execution-unit entry used to trigger work execution generation.
export class WorkExecuteGenerator implements IExecutionUnitGenerator<ExecutionUnitResult<WorkExecuteArtifacts>> {
  private readonly generator: IExecutionUnitGenerator<ExecutionUnitResult<WorkExecuteArtifacts>>;

  constructor(dependencies: WorkExecuteGeneratorDependencies) {
    this.generator = WorkExecuteService.create(
      dependencies.llmExecutor,
    );
  }

  async run(context: ExecutionContext): Promise<ExecutionUnitResult<WorkExecuteArtifacts>> {
    return this.generator.run(context);
  }
}
