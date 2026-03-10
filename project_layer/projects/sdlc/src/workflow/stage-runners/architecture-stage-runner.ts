import type {
  GateDecision,
  IChangeGate,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import { ArchitectureDesignContract } from "../../contract/architecture-design-contract/architecture-design-contract.js";
import {
  ArchitectureDesignGenerator,
  type ArchitectureDesignArtifacts,
} from "../../execution/architecture-design-generator/architecture-design-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
import { resolveArchitectureArtifactPath } from "./stage-artifact-paths.js";

export interface ArchitectureStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

export class ArchitectureStageRunner extends BaseStageRunner {
  private readonly generator: ArchitectureDesignGenerator;
  private readonly contractChecker: ArchitectureDesignContract;

  constructor(private readonly dependencies: ArchitectureStageRunnerDependencies) {
    super(dependencies);
    this.generator = new ArchitectureDesignGenerator({
      llmExecutor: dependencies.llmExecutor,
      traceRecorder: dependencies.traceRecorder,
    });
    this.contractChecker = new ArchitectureDesignContract(dependencies.llmExecutor);
  }

  async run(
    context: StageRunContext,
  ): Promise<StageOutput<ArchitectureDesignArtifacts & { architecture_document: string }>> {
    await this.recordStageStart(context);

    const output = await this.generator.run(context) as StageOutput<ArchitectureDesignArtifacts>;
    const contractResult = await this.contractChecker.check(context, output);
    await this.recordSharedContractResult(context, contractResult);
    if (!contractResult.passed) {
      throw new Error(`Architecture contract failed: ${contractResult.summary}`);
    }

    const artifactPath = resolveArchitectureArtifactPath(context.workspaceRoot);
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
        architecture_document: artifactPath,
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
    const artifactPath = resolveArchitectureArtifactPath(context.workspaceRoot);
    return {
      taskId: context.taskId,
      stageId: context.stageId,
      summary: "Architecture design document ready for review.",
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
      `Accepted architecture artifact persisted to ${artifactPath}.`,
      gateDecision,
    );
  }
}
