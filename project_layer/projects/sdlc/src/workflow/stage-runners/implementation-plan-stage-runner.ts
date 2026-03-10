import type {
  GateDecision,
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
import { resolveImplementationPlanArtifactPath } from "./stage-artifact-paths.js";

export interface ImplementationPlanStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

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
  ): Promise<StageOutput<ImplementationPlanArtifacts & {
      implementation_workplan: string;
      parsed_implementation_workplan: string;
      current_step: string;
    }>> {
    await this.recordStageStart(context);

    const output = await this.generator.run(context) as StageOutput<ImplementationPlanArtifacts>;
    const contractResult = await this.contractChecker.check(context, output);
    await this.recordSharedContractResult(context, contractResult);
    if (!contractResult.passed) {
      throw new Error(`Implementation plan contract failed: ${contractResult.summary}`);
    }

    const artifactPath = resolveImplementationPlanArtifactPath(context.workspaceRoot);
    const gateDecision = await this.reviewChanges(this.buildReviewRequest(context, output.artifacts.content));
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.writeWorkspaceFile(context, artifactPath, output.artifacts.content);
    await this.recordPersistenceResult(context, gateDecision, artifactPath);
    const parsedWorkplan = this.contractChecker.parseWorkPlan(output.artifacts.content);

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        implementation_workplan: artifactPath,
        parsed_implementation_workplan: JSON.stringify(parsedWorkplan),
        current_step: JSON.stringify(this.resolveInitialCurrentStep(parsedWorkplan)),
      },
    };
  }

  private resolveInitialCurrentStep(parsedWorkplan: { steps: Array<{ stepId: string; batches: Array<{ batchId: string }> }> }): {
    stepId: string;
    batchId: string;
  } {
    const firstStep = parsedWorkplan.steps[0];
    const firstBatch = firstStep?.batches[0];
    if (!firstStep || !firstBatch) {
      throw new Error("Parsed implementation workplan must contain at least one step and one batch.");
    }

    return {
      stepId: firstStep.stepId,
      batchId: firstBatch.batchId,
    };
  }

  private buildReviewRequest(context: StageRunContext, content: string): {
    taskId: string;
    stageId: string;
    summary: string;
    changedPaths: string[];
    changedFiles: ChangedFile[];
  } {
    const artifactPath = resolveImplementationPlanArtifactPath(context.workspaceRoot);
    return {
      taskId: context.taskId,
      stageId: context.stageId,
      summary: "Implementation workplan ready for review.",
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
      `Accepted implementation-plan artifact persisted to ${artifactPath}.`,
      gateDecision,
    );
  }
}
