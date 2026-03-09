import type {
  GateDecision,
  IArtifactStore,
  IChangeGate,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import { ImplementationPlanContract } from "../../contract/implementation-plan-contract/implementation-plan-contract.js";
import {
  ImplementationPlanGenerator,
  type ImplementationPlanArtifacts,
} from "../../execution/implementation-plan-generator/implementation-plan-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";

export interface ImplementationPlanStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
  artifactStore: IArtifactStore;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

const IMPLEMENTATION_PLAN_ARTIFACT_PATH = "plans/implementation/ImplementationWorkPlan.md";

export class ImplementationPlanStageRunner extends BaseStageRunner {
  private readonly generator: ImplementationPlanGenerator;
  private readonly contractChecker: ImplementationPlanContract;

  constructor(private readonly dependencies: ImplementationPlanStageRunnerDependencies) {
    super(dependencies);
    this.generator = new ImplementationPlanGenerator({
      llmExecutor: dependencies.llmExecutor,
      traceRecorder: dependencies.traceRecorder,
    });
    this.contractChecker = new ImplementationPlanContract(dependencies.llmExecutor);
  }

  async run(
    context: StageRunContext,
  ): Promise<StageOutput<ImplementationPlanArtifacts & { implementation_workplan: string; parsed_implementation_workplan: string }>> {
    await this.recordStageStart(context);

    const output = await this.generator.run(context) as StageOutput<ImplementationPlanArtifacts>;
    const contractResult = await this.contractChecker.check(context, output);
    await this.recordContractResult(context, contractResult.passed, contractResult.summary);
    if (!contractResult.passed) {
      throw new Error(`Implementation plan contract failed: ${contractResult.summary}`);
    }

    const gateDecision = await this.reviewChanges(this.buildReviewRequest(context, output.artifacts.content));
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.persistAcceptedArtifact(context, output.artifacts.content);
    await this.recordPersistenceResult(context, gateDecision);
    const parsedWorkplan = this.contractChecker.parseWorkPlan(output.artifacts.content);

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        implementation_workplan: IMPLEMENTATION_PLAN_ARTIFACT_PATH,
        parsed_implementation_workplan: JSON.stringify(parsedWorkplan),
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
      summary: "Implementation workplan ready for review.",
      changedPaths: [IMPLEMENTATION_PLAN_ARTIFACT_PATH],
      changedFiles: [
        {
          path: IMPLEMENTATION_PLAN_ARTIFACT_PATH,
          operation: "update",
          content,
        },
      ],
    };
  }

  private async persistAcceptedArtifact(context: StageRunContext, content: string): Promise<void> {
    if (!this.artifactStore) {
      throw new Error("ImplementationPlanStageRunner requires an artifactStore.");
    }

    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      stageId: context.stageId,
      filePath: IMPLEMENTATION_PLAN_ARTIFACT_PATH,
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
      summary: `Accepted implementation-plan artifact persisted to ${IMPLEMENTATION_PLAN_ARTIFACT_PATH}.`,
      metadata: {
        action: gateDecision.action,
        filePath: IMPLEMENTATION_PLAN_ARTIFACT_PATH,
      },
    });
  }
}
