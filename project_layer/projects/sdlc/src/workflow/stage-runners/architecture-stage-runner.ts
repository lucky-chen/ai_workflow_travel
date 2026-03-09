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
import { ArchitectureDesignContract } from "../../contract/architecture-design-contract/architecture-design-contract.js";
import {
  ArchitectureDesignGenerator,
  type ArchitectureDesignArtifacts,
} from "../../execution/architecture-design-generator/architecture-design-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";

export interface ArchitectureStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
  artifactStore: IArtifactStore;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

const ARCHITECTURE_ARTIFACT_PATH = "docs/architecture/TechnicalArchitecture.md";

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
    await this.recordSharedContractResult(context, contractResult.passed, contractResult.summary);
    if (!contractResult.passed) {
      throw new Error(`Architecture contract failed: ${contractResult.summary}`);
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
        architecture_document: ARCHITECTURE_ARTIFACT_PATH,
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
      summary: "Architecture design document ready for review.",
      changedPaths: [ARCHITECTURE_ARTIFACT_PATH],
      changedFiles: [
        {
          path: ARCHITECTURE_ARTIFACT_PATH,
          operation: "update",
          content,
        },
      ],
    };
  }

  private async persistAcceptedArtifact(context: StageRunContext, content: string): Promise<void> {
    if (!this.artifactStore) {
      throw new Error("ArchitectureStageRunner requires an artifactStore.");
    }

    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      stageId: context.stageId,
      filePath: ARCHITECTURE_ARTIFACT_PATH,
      content,
    });
  }

  private async recordPersistenceResult(context: StageRunContext, gateDecision: GateDecision): Promise<void> {
    await super.recordSharedPersistenceResult(
      context,
      ARCHITECTURE_ARTIFACT_PATH,
      `Accepted architecture artifact persisted to ${ARCHITECTURE_ARTIFACT_PATH}.`,
      gateDecision,
    );
  }
}
