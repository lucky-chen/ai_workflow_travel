import type { GateDecision, IChangeGate, ITraceRecorder, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import { RequirementContract } from "../../contract/requirement-contract/requirement-contract.js";
import { RequirementGenerator, type RequirementArtifacts } from "../../execution/requirement-generator/requirement-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
import { resolveRequirementArtifactPath } from "./stage-artifact-paths.js";

export interface RequirementStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

export class RequirementStageRunner extends BaseStageRunner {
  private readonly generator = new RequirementGenerator();
  private readonly contractChecker: RequirementContract;

  constructor(dependencies: RequirementStageRunnerDependencies) {
    super(dependencies);
    this.contractChecker = new RequirementContract(dependencies.llmExecutor);
  }

  async run(context: StageRunContext): Promise<StageOutput<RequirementArtifacts & { requirement_document: string }>> {
    await this.recordStageStart(context);

    const output = await this.generator.run(context);
    const contractResult = await this.contractChecker.check(context, output);
    await this.recordSharedContractResult(context, contractResult);
    if (!contractResult.passed) {
      await this.persistContractFailureReview(context, output, contractResult);
      throw new Error(`Requirement contract failed: ${contractResult.summary}`);
    }

    const artifactPath = resolveRequirementArtifactPath(context.workspaceRoot);
    const gateDecision = await this.reviewChanges(this.buildReviewRequest(context, output.artifacts.content));
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.writeWorkspaceFile(context, artifactPath, output.artifacts.content);
    await this.recordPersistenceResult(context, gateDecision, artifactPath);

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        requirement_document: artifactPath,
      },
    };
  }

  private buildReviewRequest(context: StageRunContext, content: string): {
    taskId: string;
    stageId: string;
    summary: string;
    changedPaths: string[];
    changedFiles: ChangedFile[];
  } {
    const artifactPath = resolveRequirementArtifactPath(context.workspaceRoot);
    return {
      taskId: context.taskId,
      stageId: context.stageId,
      summary: "Requirement document ready for review.",
      changedPaths: [artifactPath],
      changedFiles: [
        {
          path: artifactPath,
          operation: "update",
          content,
        },
      ],
    };
  }

  private async recordPersistenceResult(
    context: StageRunContext,
    gateDecision: GateDecision,
    artifactPath: string,
  ): Promise<void> {
    await super.recordSharedPersistenceResult(
      context,
      artifactPath,
      `Accepted requirement artifact persisted to ${artifactPath}.`,
      gateDecision,
    );
  }
}
