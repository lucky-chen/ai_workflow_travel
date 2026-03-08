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
import { ModuleDesignContract } from "../../contract/module-design-contract/module-design-contract.js";
import {
  ModuleDesignGenerator,
  type ModuleDesignArtifacts,
} from "../../execution/module-design-generator/module-design-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";

export interface ModuleStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
  artifactStore: IArtifactStore;
  traceRecorder?: ITraceRecorder;
  changeGate?: IChangeGate;
}

export class ModuleStageRunner extends BaseStageRunner {
  private readonly generator: ModuleDesignGenerator;
  private readonly contractChecker: ModuleDesignContract;

  constructor(private readonly dependencies: ModuleStageRunnerDependencies) {
    super(dependencies);
    this.generator = new ModuleDesignGenerator({
      llmExecutor: dependencies.llmExecutor,
      traceRecorder: dependencies.traceRecorder,
    });
    this.contractChecker = new ModuleDesignContract(dependencies.llmExecutor);
  }

  async run(
    context: StageRunContext,
  ): Promise<StageOutput<ModuleDesignArtifacts & { module_design_document: string }>> {
    await this.recordStageStart(context);

    const output = await this.generator.run(context) as StageOutput<ModuleDesignArtifacts>;
    const contractResult = await this.contractChecker.check(context, output);
    await this.recordContractResult(context, contractResult.passed, contractResult.summary);
    if (!contractResult.passed) {
      throw new Error(`Module design contract failed: ${contractResult.summary}`);
    }

    const artifactPath = this.buildArtifactPath(output.artifacts.moduleName);
    const gateDecision = await this.reviewChanges(this.buildReviewRequest(context, artifactPath, output.artifacts));
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.persistAcceptedArtifact(context, artifactPath, output.artifacts.content);
    await this.recordPersistenceResult(context, gateDecision, artifactPath);

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        module_design_document: artifactPath,
      },
    };
  }

  private buildArtifactPath(moduleName: string): string {
    return `docs/module_design/${moduleName}.md`;
  }

  private buildReviewRequest(
    context: StageRunContext,
    artifactPath: string,
    artifacts: ModuleDesignArtifacts,
  ): {
    taskId: string;
    stageId: string;
    summary: string;
    changedPaths: string[];
    changedFiles: ChangedFile[];
  } {
    return {
      taskId: context.taskId,
      stageId: context.stageId,
      summary: `Module design document for "${artifacts.moduleName}" ready for review.`,
      changedPaths: [artifactPath],
      changedFiles: [
        {
          path: artifactPath,
          operation: "update",
          content: artifacts.content,
        },
      ],
    };
  }

  private async persistAcceptedArtifact(context: StageRunContext, artifactPath: string, content: string): Promise<void> {
    if (!this.artifactStore) {
      throw new Error("ModuleStageRunner requires an artifactStore.");
    }

    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      stageId: context.stageId,
      filePath: artifactPath,
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

  private async recordPersistenceResult(
    context: StageRunContext,
    gateDecision: GateDecision,
    artifactPath: string,
  ): Promise<void> {
    await this.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: "artifact_persisted",
      summary: `Accepted module-design artifact persisted to ${artifactPath}.`,
      metadata: {
        action: gateDecision.action,
        filePath: artifactPath,
      },
    });
  }
}
