// Implementation stage runner: executes implementation generation, contract check, review, and final apply.
import type { IContractChecker, IStageGenerator, IStageRunner, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { IChangeGate } from "../../shared/contracts/change-gate.js";
import type { ImplementationStageArtifacts } from "../../shared/contracts/pipeline.js";
import { ChangeApplier } from "../../execution/implementation-generator/change-applier.js";

export interface ImplementationStageRunnerDependencies {
  generator: IStageGenerator<StageOutput<ImplementationStageArtifacts>>;
  contractChecker: IContractChecker;
  changeGate: IChangeGate;
}

export class ImplementationStageRunner implements IStageRunner {
  private readonly changeApplier = new ChangeApplier();

  constructor(private readonly dependencies: ImplementationStageRunnerDependencies) {}

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    const output = await this.dependencies.generator.run(context);
    const contractResult = await this.dependencies.contractChecker.check(context, output);
    if (!contractResult.passed) {
      throw new Error(`Implementation contract failed: ${contractResult.summary}`);
    }

    const gateDecision = await this.dependencies.changeGate.review({
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
}
