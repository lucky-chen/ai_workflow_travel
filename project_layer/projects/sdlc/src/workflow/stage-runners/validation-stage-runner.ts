import type {
  ChangeReviewRequest,
  IArtifactStore,
  IChangeGate,
  IStageRunner,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES, toCanonicalStageId } from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import { ShellRunner, type ShellResult } from "../shell-runner.js";

export interface ValidationStageArtifacts {
  artifactKey: "work_execute_contract_result";
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

const VALIDATION_ARTIFACT_PATH = "artifacts/work/work_execute_contract_result.json";

export class ValidationStageRunner implements IStageRunner {
  private readonly shellRunner: ShellRunner;

  constructor(private readonly dependencies: ValidationStageRunnerDependencies = {}) {
    this.shellRunner = dependencies.shellRunner ?? new ShellRunner();
  }

  async run(context: StageRunContext): Promise<ValidationStageOutput> {
    const canonicalStageId = toCanonicalStageId(context.stageId);

    await this.dependencies.traceRecorder?.recordTrace({
      caller: "ValidationStageRunner.run",
      stageId: canonicalStageId,
      eventType: TRACE_EVENT_TYPES.stageStarted,
      summary: `Stage "${canonicalStageId}" started.`,
      payload: {
        inputPaths: [],
      },
    });

    const projectPath = this.parseProjectPath(context);
    const command = this.buildCommand(context, projectPath);
    const shellResult = await this.shellRunner.run(command);
    const output = this.buildOutput(projectPath, shellResult);

    await this.dependencies.traceRecorder?.recordTrace({
      caller: "ValidationStageRunner.run",
      stageId: canonicalStageId,
      eventType: TRACE_EVENT_TYPES.validationFinished,
      summary: output.summary,
      metadata: {
        passed: String(output.success),
        command,
      },
    });

    if (this.dependencies.changeGate) {
      const decision = await this.dependencies.changeGate.review(this.buildReviewRequest(context, output));
      await this.dependencies.traceRecorder?.recordTrace({
        caller: "ValidationStageRunner.run",
        stageId: canonicalStageId,
        eventType: TRACE_EVENT_TYPES.gateReviewed,
        summary: decision.summary,
        payload: {
          outputPaths: [VALIDATION_ARTIFACT_PATH],
        },
        metadata: {
          action: decision.action,
          ...(decision.comment ? { comment: decision.comment } : {}),
        },
      });

      if (decision.action !== "apply") {
        throw new Error(`Work execute contract review ended with action "${decision.action}".`);
      }
    }

    if (this.dependencies.artifactStore) {
      await this.dependencies.artifactStore.writeArtifact({
        taskId: context.taskId,
        stageId: context.stageId,
        filePath: VALIDATION_ARTIFACT_PATH,
        content: JSON.stringify(output.artifacts, null, 2),
        workspaceRoot: context.workspaceRoot,
      });

      await this.dependencies.traceRecorder?.recordTrace({
        caller: "ValidationStageRunner.run",
        stageId: canonicalStageId,
        eventType: TRACE_EVENT_TYPES.artifactPersisted,
        summary: `Work execute contract result persisted to ${VALIDATION_ARTIFACT_PATH}.`,
        payload: {
          outputPaths: [VALIDATION_ARTIFACT_PATH],
        },
        metadata: {
          filePath: VALIDATION_ARTIFACT_PATH,
        },
      });
    }

    return output;
  }

  private parseProjectPath(context: StageRunContext): string {
    return context.workspaceRoot;
  }

  private buildCommand(context: StageRunContext, projectPath: string): string {
    return context.params?.validationCommand?.trim() || `cd "${projectPath}" && npm test`;
  }

  private buildOutput(projectPath: string, shellResult: ShellResult): ValidationStageOutput {
    return {
      stageId: "work_execute_contract",
      success: shellResult.passed,
      summary: shellResult.summary,
      artifacts: {
        artifactKey: "work_execute_contract_result",
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
      stageId: output.stageId,
      summary: output.summary,
      changedPaths: [VALIDATION_ARTIFACT_PATH],
      changedFiles,
    };
  }
}
