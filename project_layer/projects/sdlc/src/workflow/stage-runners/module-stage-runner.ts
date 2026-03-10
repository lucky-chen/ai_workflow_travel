import type {
  GateDecision,
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
  type ModuleDescriptor,
  type ModuleDesignArtifacts,
} from "../../execution/module-design-generator/module-design-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
import { resolveModuleDesignArtifactPath } from "./stage-artifact-paths.js";

export interface ModuleStageRunnerDependencies extends BaseStageRunnerDependencies {
  llmExecutor: ILlmExecutor;
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
    await this.recordSharedContractResult(context, contractResult);
    if (!contractResult.passed) {
      throw new Error(`Module design contract failed: ${contractResult.summary}`);
    }

    const artifactPath = this.readTargetPath(context.workspaceRoot, context, output.artifacts);
    const gateDecision = await this.reviewChanges(this.buildReviewRequest(context, artifactPath, output.artifacts));
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.writeWorkspaceFile(context, artifactPath, output.artifacts.content);
    await this.recordPersistenceResult(context, gateDecision, artifactPath);

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        module_design_document: artifactPath,
      },
    };
  }

  private buildArtifactPath(workspaceRoot: string, moduleName: string): string {
    return resolveModuleDesignArtifactPath(workspaceRoot, moduleName);
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

  private readTargetPath(workspaceRoot: string, context: StageRunContext, artifacts: ModuleDesignArtifacts): string {
    if (artifacts.documentPath.trim().length > 0) {
      return artifacts.documentPath;
    }

    const descriptor = this.readModuleDescriptor(context);
    return descriptor.documentPath?.trim() || this.buildArtifactPath(workspaceRoot, artifacts.moduleName);
  }

  private async recordPersistenceResult(
    context: StageRunContext,
    gateDecision: GateDecision,
    artifactPath: string,
  ): Promise<void> {
    await super.recordSharedPersistenceResult(
      context,
      artifactPath,
      `Accepted module-design artifact persisted to ${artifactPath}.`,
      gateDecision,
    );
  }

  private readModuleDescriptor(context: StageRunContext): ModuleDescriptor {
    const rawDescriptor = context.inputArtifacts.module_descriptors;
    if (!rawDescriptor) {
      throw new Error('Missing required input artifact "module_descriptors".');
    }

    return JSON.parse(rawDescriptor) as ModuleDescriptor;
  }
}
