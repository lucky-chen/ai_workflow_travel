// Work-execute service: orchestrates loading, prompting, execution, and output shaping.
import type { ILlmExecutor } from "../../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type {
  IExecutionUnitGenerator,
  WorkExecuteArtifacts,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../../Runtime/Unit/execution-unit.js";
import { ChangeApplier } from "./change-applier.js";
import { ExecutionContextLoader } from "./execution-context-loader.js";
import { WorkExecutePromptBuilder } from "./work-execute-prompt-builder.js";
import { ProjectContextLoader } from "./project-context-loader.js";
import { ExecutionOutputBuilder } from "./execution-output-builder.js";

export class WorkExecuteService implements IExecutionUnitGenerator {
  static create(
    llmExecutor: ILlmExecutor,
  ): IExecutionUnitGenerator<ExecutionUnitResult<WorkExecuteArtifacts>> {
    return new WorkExecuteService(
      new ExecutionContextLoader(),
      new ProjectContextLoader(),
      new WorkExecutePromptBuilder(),
      llmExecutor,
      new ChangeApplier(),
      new ExecutionOutputBuilder(),
    );
  }

  constructor(
    private readonly executionContextLoader: ExecutionContextLoader,
    private readonly projectContextLoader: ProjectContextLoader,
    private readonly promptBuilder: WorkExecutePromptBuilder,
    private readonly llmExecutor: ILlmExecutor,
    private readonly changeApplier: ChangeApplier,
    private readonly outputBuilder: ExecutionOutputBuilder,
  ) {}

  async run(context: ExecutionContext): Promise<ExecutionUnitResult<WorkExecuteArtifacts>> {
    const preparedStepContext = this.executionContextLoader.load(context.inputArtifacts);
    const projectContext = await this.projectContextLoader.loadProjectContext(context);
    const request = this.promptBuilder.build({ preparedStepContext, projectContext });
    const llmResult = await this.llmExecutor.execute(request);
    const generatedChanges = this.changeApplier.parseGeneratedChanges(llmResult);
    return this.outputBuilder.build(context.executionUnitId, generatedChanges);
  }
}
