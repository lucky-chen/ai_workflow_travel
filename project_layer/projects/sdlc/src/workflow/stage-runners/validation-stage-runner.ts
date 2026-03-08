import type {
  ChangeReviewRequest,
  IArtifactStore,
  IChangeGate,
  IStageRunner,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import { ShellRunner, type ShellResult } from "../validation/shell-runner.js";

export interface ValidationStageArtifacts {
  artifactKey: "validation_result";
  projectPath: string;
  command: string;
  exitCode: number;
  logs?: string;
  passed: boolean;
}

export type ValidationStageOutput = StageOutput<ValidationStageArtifacts>;

export interface ValidationStageRunnerDependencies {
  traceRecorder?: ITraceRecorder;
  artifactStore?: IArtifactStore;
  changeGate?: IChangeGate;
  shellRunner?: ShellRunner;
}

const VALIDATION_ARTIFACT_PATH = "reports/validation/ValidationResult.json";

export class ValidationStageRunner implements IStageRunner {
  private readonly shellRunner: ShellRunner;

  constructor(private readonly dependencies: ValidationStageRunnerDependencies = {}) {
    this.shellRunner = dependencies.shellRunner ?? new ShellRunner();
  }

  async run(context: StageRunContext): Promise<ValidationStageOutput> {
    await this.dependencies.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: "stage_started",
      summary: `Stage "${context.stageId}" started.`,
    });

    const projectPath = this.parseProjectPath(context);
    const command = this.buildCommand(context, projectPath);
    const shellResult = await this.shellRunner.run(command);
    const output = this.buildOutput(projectPath, shellResult);

    await this.dependencies.traceRecorder?.recordTrace({
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: "validation_finished",
      summary: output.summary,
      metadata: {
        passed: String(output.success),
        command,
      },
    });

    if (this.dependencies.changeGate) {
      const decision = await this.dependencies.changeGate.review(this.buildReviewRequest(context, output));
      await this.dependencies.traceRecorder?.recordTrace({
        taskId: context.taskId,
        stageId: context.stageId,
        eventType: "gate_reviewed",
        summary: decision.summary,
        metadata: {
          action: decision.action,
        },
      });

      if (decision.action !== "apply") {
        throw new Error(`Validation review ended with action "${decision.action}".`);
      }
    }

    if (this.dependencies.artifactStore) {
      await this.dependencies.artifactStore.writeArtifact({
        taskId: context.taskId,
        stageId: context.stageId,
        filePath: VALIDATION_ARTIFACT_PATH,
        content: JSON.stringify(output.artifacts, null, 2),
      });

      await this.dependencies.traceRecorder?.recordTrace({
        taskId: context.taskId,
        stageId: context.stageId,
        eventType: "artifact_persisted",
        summary: `Validation result persisted to ${VALIDATION_ARTIFACT_PATH}.`,
        metadata: {
          filePath: VALIDATION_ARTIFACT_PATH,
        },
      });
    }

    return output;
  }

  private parseProjectPath(context: StageRunContext): string {
    const projectPath = context.inputArtifacts.project_path?.trim();
    if (!projectPath) {
      throw new Error('Missing required input artifact "project_path".');
    }
    return projectPath;
  }

  private buildCommand(context: StageRunContext, projectPath: string): string {
    return context.params?.validationCommand?.trim() || `cd "${projectPath}" && npm test`;
  }

  private buildOutput(projectPath: string, shellResult: ShellResult): ValidationStageOutput {
    return {
      stageId: "validation",
      success: shellResult.passed,
      summary: shellResult.summary,
      artifacts: {
        artifactKey: "validation_result",
        projectPath,
        command: shellResult.command,
        exitCode: shellResult.exit_code,
        logs: shellResult.logs,
        passed: shellResult.passed,
      },
    };
  }

  private buildReviewRequest(
    context: StageRunContext,
    output: ValidationStageOutput,
  ): ChangeReviewRequest {
    const changedFiles: ChangedFile[] = [
      {
        path: VALIDATION_ARTIFACT_PATH,
        operation: "update",
        content: JSON.stringify(output.artifacts, null, 2),
      },
    ];

    return {
      taskId: context.taskId,
      stageId: context.stageId,
      summary: output.summary,
      changedPaths: [VALIDATION_ARTIFACT_PATH],
      changedFiles,
    };
  }
}
