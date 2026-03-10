import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ChangeReviewRequest,
  ContractCheckResult,
  GateDecision,
  IArtifactStore,
  IChangeGate,
  IContractChecker,
  IStageRunner,
  ITraceRecorder,
  StageOutput,
  StageRunContext,
  StageRunnerSharedDependencies,
} from "../../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../../shared/contracts/pipeline.js";
import {
  resolveArchitectureArtifactPath,
  resolveImplementationPlanArtifactPath,
  resolveModuleDesignDirectoryPath,
  resolveRequirementArtifactPath,
} from "./stage-artifact-paths.js";

export interface BaseStageRunnerDependencies extends StageRunnerSharedDependencies {
  changeGate?: IChangeGate;
  artifactStore?: IArtifactStore;
}

export abstract class BaseStageRunner implements IStageRunner {
  protected readonly traceRecorder?: ITraceRecorder;
  protected readonly changeGate?: IChangeGate;
  protected readonly artifactStore?: IArtifactStore;

  constructor(dependencies: BaseStageRunnerDependencies = {}) {
    this.traceRecorder = dependencies.traceRecorder;
    this.changeGate = dependencies.changeGate;
    this.artifactStore = dependencies.artifactStore;
  }

  abstract run(context: StageRunContext): Promise<StageOutput>;

  protected async recordStageStart(context: StageRunContext): Promise<void> {
    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.recordStageStart`,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.stageStarted,
      summary: `Stage "${context.stageId}" started.`,
      payload: {
        inputPaths: this.resolveStageInputPaths(context),
      },
    });
  }

  protected async runContractCheck(
    contractChecker: IContractChecker,
    context: StageRunContext,
    output: StageOutput,
  ): Promise<ContractCheckResult> {
    return contractChecker.check(context, output);
  }

  protected async recordSharedContractResult(
    context: StageRunContext,
    result: ContractCheckResult,
  ): Promise<void> {
    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.recordSharedContractResult`,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.contractChecked,
      summary: result.summary,
      category: "contract",
      payload: {
        passed: result.passed,
        issues: result.issues,
      },
      metadata: {
        passed: String(result.passed),
      },
    });
  }

  protected async recordSharedPersistenceResult(
    context: StageRunContext,
    artifactPath: string,
    summary: string,
    gateDecision?: GateDecision,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.recordSharedPersistenceResult`,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.artifactPersisted,
      summary,
      payload: {
        outputPaths: [artifactPath],
        ...(payload ?? {}),
      },
      metadata: {
        filePath: artifactPath,
        ...(gateDecision ? { action: gateDecision.action } : {}),
      },
    });
  }

  protected async reviewChanges(changeRequest: ChangeReviewRequest): Promise<GateDecision> {
    const decision: GateDecision = this.changeGate
      ? await this.changeGate.review(changeRequest)
      : {
          action: "apply",
        summary: "No change gate configured. Changes applied by default.",
        };

    await this.traceRecorder?.recordTrace({
      caller: `${this.constructor.name}.reviewChanges`,
      stageId: changeRequest.stageId,
      eventType: TRACE_EVENT_TYPES.gateReviewed,
      summary: decision.summary,
      category: "review",
      payload: {
        action: decision.action,
        changedPaths: changeRequest.changedPaths,
        outputPaths: changeRequest.changedPaths,
        changedFiles: changeRequest.changedFiles,
        ...(decision.comment ? { comment: decision.comment } : {}),
      },
      metadata: {
        action: decision.action,
        ...(decision.comment ? { comment: decision.comment } : {}),
      },
    });

    return decision;
  }

  protected async writeWorkspaceFile(
    context: StageRunContext,
    relativePath: string,
    content: string,
  ): Promise<void> {
    const targetPath = path.join(context.workspaceRoot, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }

  private resolveStageInputPaths(context: StageRunContext): string[] {
    switch (context.stageId) {
      case "requirement_interpretation":
        return [resolveRequirementArtifactPath(context.workspaceRoot)];
      case "architecture_design":
        return [resolveRequirementArtifactPath(context.workspaceRoot)];
      case "module_design":
        return [resolveArchitectureArtifactPath(context.workspaceRoot)];
      case "implementation_plan":
        return [
          resolveRequirementArtifactPath(context.workspaceRoot),
          resolveArchitectureArtifactPath(context.workspaceRoot),
          resolveModuleDesignDirectoryPath(context.workspaceRoot),
        ];
      case "implementation":
      case "implementation_execution":
        return this.resolveImplementationExecutionInputPaths(context);
      default:
        return [];
    }
  }

  private resolveImplementationExecutionInputPaths(context: StageRunContext): string[] {
    const outputPaths = [
      resolveImplementationPlanArtifactPath(context.workspaceRoot),
      resolveRequirementArtifactPath(context.workspaceRoot),
      resolveArchitectureArtifactPath(context.workspaceRoot),
    ];
    const rawModuleDesignDocuments = context.inputArtifacts.module_design_documents;

    if (!rawModuleDesignDocuments?.trim()) {
      return outputPaths;
    }

    try {
      const parsed = JSON.parse(rawModuleDesignDocuments) as unknown;
      if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string" && entry.endsWith(".md"))) {
        outputPaths.push(...parsed);
        return [...new Set(outputPaths)];
      }
    } catch {
      // Ignore non-path serialized inputs and fall back to the canonical directory path.
    }

    outputPaths.push(resolveModuleDesignDirectoryPath(context.workspaceRoot));
    return [...new Set(outputPaths)];
  }

}
