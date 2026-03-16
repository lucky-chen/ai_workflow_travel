import type {
  GateDecision,
  IChangeGate,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { ILlmExecutor } from "../../sdk/llm-executor/llm-executor.js";
import { ArchitectureDesignContract } from "../../contract/architecture-design-contract.js";
import {
  ArchitectureDesignGenerator,
  type ArchitectureDesignArtifacts,
} from "../../execution/architecture-design-generator.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
import {
  resolveArchitectureArtifactPath,
  resolveArchitectureContractResultArtifactPath,
} from "./stage-artifact-paths.js";

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
  ): Promise<StageOutput<
      (ArchitectureDesignArtifacts & { architecture_design: string; architecture_document: string })
      | { architecture_document: string; architecture_design_contract_result: string; contract_result: string }
    >> {
    if (context.params?.executionUnit === "architecture_design_contract") {
      return this.runContractUnit(context);
    }

    await this.recordStageStart(context);

    const output = await this.generator.run(context) as StageOutput<ArchitectureDesignArtifacts>;
    await this.persistGeneratedStageArtifact(context, output, "TechnicalArchitecture.generated.md");
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
        architecture_design: artifactPath,
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

  private async runContractUnit(
    context: StageRunContext,
  ): Promise<StageOutput<{
      architecture_document: string;
      architecture_design_contract_result: string;
      contract_result: string;
    }>> {
    await this.recordStageStart(context);

    const architectureDocument = context.inputArtifacts.architecture_document?.trim();
    if (!architectureDocument) {
      throw new Error('Missing required input artifact "architecture_document".');
    }

    const contractResult = await this.contractChecker.check(context, {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture design contract check requested.",
      artifacts: {
        artifactKey: "architecture_design",
        content: architectureDocument,
      },
    });
    await this.recordSharedContractResult(context, contractResult);
    const contractResultPath = resolveArchitectureContractResultArtifactPath(context.workspaceRoot);
    await this.writeWorkspaceFile(context, contractResultPath, JSON.stringify(contractResult, null, 2));
    await super.recordSharedPersistenceResult(
      context,
      contractResultPath,
      `Accepted architecture-design contract artifact persisted to ${contractResultPath}.`,
    );

    return {
      stageId: "architecture_design",
      success: contractResult.passed,
      summary: contractResult.summary,
      artifacts: {
        architecture_document: architectureDocument,
        architecture_design_contract_result: contractResultPath,
        contract_result: JSON.stringify(contractResult),
      },
    };
  }
}
