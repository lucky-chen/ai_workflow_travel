// Implementation stage runner: executes implementation generation, contract check, review, and final apply.
import type { IContractChecker, IStageGenerator, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ImplementationStageArtifacts } from "../../shared/contracts/pipeline.js";
import { ChangeApplier } from "../../execution/implementation-generator/change-applier.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";

export class ImplementationStageRunner extends BaseStageRunner {
  private readonly changeApplier = new ChangeApplier();

  constructor(
    private readonly dependencies: BaseStageRunnerDependencies & {
      generator: IStageGenerator<StageOutput<ImplementationStageArtifacts>>;
      contractChecker: IContractChecker;
    },
  ) {
    super(dependencies);
  }

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    this.validateExecutionContext(context);
    await this.recordStageStart(context);

    const output = await this.dependencies.generator.run(context);
    const contractResult = await this.runContractCheck(this.dependencies.contractChecker, context, output);
    if (!contractResult.passed) {
      throw new Error(`Implementation contract failed: ${contractResult.summary}`);
    }

    const gateDecision = await this.reviewChanges({
      taskId: context.taskId,
      stageId: context.stageId,
      summary: output.summary,
      changedPaths: output.artifacts.changedFiles.map((file) => file.path),
      changedFiles: output.artifacts.changedFiles,
    });
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.changeApplier.applyChangedFiles(output.artifacts.changedFiles, context.workspaceRoot);
    return output;
  }

  private validateExecutionContext(context: StageRunContext): void {
    const implementationWorkplan = context.inputArtifacts.implementation_workplan?.trim();
    if (!implementationWorkplan) {
      throw new Error('Missing required input artifact "implementation_workplan".');
    }

    const currentStep = context.inputArtifacts.current_step?.trim();
    if (!currentStep) {
      throw new Error('Missing required input artifact "current_step".');
    }
  }
}
