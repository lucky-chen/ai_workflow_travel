import type { GateDecision, IArtifactStore, IChangeGate, ITraceRecorder, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import { RequirementContract } from "../../contract/requirement-contract/requirement-contract.js";
import { RequirementGenerator, type RequirementArtifacts } from "../../execution/requirement-generator/requirement-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";

export interface RequirementStageRunnerDependencies extends BaseStageRunnerDependencies {
  artifactStore: IArtifactStore;
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

const REQUIREMENT_ARTIFACT_PATH = "docs/requirements/Requirement.md";

export class RequirementStageRunner extends BaseStageRunner {
  private readonly generator = new RequirementGenerator();
  private readonly contractChecker: RequirementContract;

  constructor(dependencies: RequirementStageRunnerDependencies) {
    super(dependencies);
    this.contractChecker = new RequirementContract({
      llmExecutor: dependencies.llmExecutor,
    });
  }

  async run(context: StageRunContext): Promise<StageOutput<RequirementArtifacts & { requirement_document: string }>> {
    await this.recordStageStart(context);

    const output = await this.generator.run(context);
    const contractResult = await this.contractChecker.check(context, output);
    await this.recordContractResult(context, contractResult.passed, contractResult.summary);
    if (!contractResult.passed) {
      throw new Error(`Requirement contract failed: ${contractResult.summary}`);
    }

    const gateDecision = await this.reviewChanges(this.buildReviewRequest(context, output.artifacts.content));
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.persistAcceptedArtifact(context, output.artifacts.content);
    await this.recordPersistenceResult(context, gateDecision);

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        requirement_document: REQUIREMENT_ARTIFACT_PATH,
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
    return {
      taskId: context.taskId,
      stageId: context.stageId,
      summary: "Requirement document ready for review.",
      changedPaths: [REQUIREMENT_ARTIFACT_PATH],
      changedFiles: [
        {
          path: REQUIREMENT_ARTIFACT_PATH,
          operation: "update",
          content,
        },
      ],
    };
  }

  private async persistAcceptedArtifact(context: StageRunContext, content: string): Promise<void> {
    if (!this.artifactStore) {
      throw new Error("RequirementStageRunner requires an artifactStore.");
    }

    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      stageId: context.stageId,
      filePath: REQUIREMENT_ARTIFACT_PATH,
      content,
    });
  }

  private async recordContractResult(context: StageRunContext, passed: boolean, summary: string): Promise<void> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: "contract_checked",
      summary,
      metadata: {
        passed: String(passed),
      },
    });
  }

  private async recordPersistenceResult(context: StageRunContext, gateDecision: GateDecision): Promise<void> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: "artifact_persisted",
      summary: `Accepted requirement artifact persisted to ${REQUIREMENT_ARTIFACT_PATH}.`,
      metadata: {
        action: gateDecision.action,
        filePath: REQUIREMENT_ARTIFACT_PATH,
      },
    });
  }
}
