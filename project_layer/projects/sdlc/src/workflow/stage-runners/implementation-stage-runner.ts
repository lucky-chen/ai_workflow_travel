// Implementation stage runner: executes implementation generation, contract check, review, and final apply.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { IContractChecker, IStageGenerator, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ImplementationStageArtifacts } from "../../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
import { ChangeApplier } from "../../execution/implementation-generator/change-applier.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
import {
  GitProcessCommitter,
  type IImplementationGitCommitter,
} from "./implementation-git-committer.js";
import type { PreparedStepContext } from "../../execution/implementation-generator/types.js";
import type {
  ImplementationWorkPlan,
  ImplementationWorkPlanBatch,
  ImplementationWorkPlanStep,
} from "../../shared/contracts/implementation-workplan.js";

interface CurrentExecutionPointer {
  stepId: string;
  batchId: string;
}

export class ImplementationStageRunner extends BaseStageRunner {
  private readonly changeApplier = new ChangeApplier();
  private readonly gitCommitter: IImplementationGitCommitter;

  constructor(
    private readonly dependencies: BaseStageRunnerDependencies & {
      generator: IStageGenerator<StageOutput<ImplementationStageArtifacts>>;
      contractChecker: IContractChecker;
      gitCommitter?: IImplementationGitCommitter;
    },
  ) {
    super(dependencies);
    this.gitCommitter = dependencies.gitCommitter ?? new GitProcessCommitter();
  }

  async run(
    context: StageRunContext,
  ): Promise<StageOutput<ImplementationStageArtifacts & { current_step?: string; implementation_execution_completed: string }>> {
    this.validateExecutionContext(context);
    await this.recordStageStart(context);

    const preparedContext = await this.prepareExecutionContext(context);
    const preparedStepContext = this.parsePreparedStepContext(preparedContext.inputArtifacts.prepared_step_context);
    const output = await this.dependencies.generator.run(preparedContext);
    await this.changeApplier.applyChangedFiles(output.artifacts.changedFiles, context.workspaceRoot);

    const contractResult = await this.runContractCheck(this.dependencies.contractChecker, context, output);
    await this.recordSharedContractResult(context, contractResult.passed, contractResult.summary);
    if (!contractResult.passed) {
      throw new Error(`Implementation contract failed: ${contractResult.summary}`);
    }

    const gateDecision = await this.reviewChanges({
      taskId: context.taskId,
      stageId: context.stageId,
      summary: output.summary,
      changedPaths: output.artifacts.changedFiles.map((file) => file.path),
      changedFiles: output.artifacts.changedFiles,
    });
    if (gateDecision.action !== "apply") {
      throw new Error(`Change review ended with action "${gateDecision.action}".`);
    }

    await this.persistAcceptedArtifacts(context, output.artifacts.changedFiles);
    await this.updateAcceptedImplementationWorkplan(context, preparedStepContext);
    await this.recordFinalStepResult(context, preparedStepContext.currentBatch.batchId, output.artifacts.changedFiles);
    const nextCurrentStep = this.resolveNextCurrentStep(
      preparedStepContext.workplan,
      preparedStepContext.currentBatch.batchId,
      preparedContext.inputArtifacts.current_step,
    );
    await this.gitCommitter.commit({
      workspaceRoot: context.workspaceRoot,
      stepId: this.parseCurrentExecutionPointer(preparedContext.inputArtifacts.current_step).stepId,
      batchId: preparedStepContext.currentBatch.batchId,
    });

    return {
      ...output,
      artifacts: {
        ...output.artifacts,
        ...(nextCurrentStep ? { current_step: JSON.stringify(nextCurrentStep) } : {}),
        implementation_execution_completed: String(nextCurrentStep === null),
      },
    };
  }

  private validateExecutionContext(context: StageRunContext): void {
    const implementationWorkplan = context.inputArtifacts.implementation_workplan?.trim();
    if (!implementationWorkplan) {
      throw new Error('Missing required input artifact "implementation_workplan".');
    }

    const parsedImplementationWorkplan = context.inputArtifacts.parsed_implementation_workplan?.trim();
    if (!parsedImplementationWorkplan) {
      throw new Error('Missing required input artifact "parsed_implementation_workplan".');
    }

    const currentStep = context.inputArtifacts.current_step?.trim();
    if (!currentStep) {
      throw new Error('Missing required input artifact "current_step".');
    }

    const requirementDocument = context.inputArtifacts.requirement_document?.trim();
    if (!requirementDocument) {
      throw new Error('Missing required input artifact "requirement_document".');
    }

    const architectureDocument = context.inputArtifacts.architecture_document?.trim();
    if (!architectureDocument) {
      throw new Error('Missing required input artifact "architecture_document".');
    }

    const moduleDesignDocuments = context.inputArtifacts.module_design_documents?.trim();
    if (!moduleDesignDocuments) {
      throw new Error('Missing required input artifact "module_design_documents".');
    }
  }

  private async prepareExecutionContext(context: StageRunContext): Promise<StageRunContext> {
    const implementationWorkplanRef = context.inputArtifacts.implementation_workplan.trim();
    const parsedWorkplan = this.parseStructuredWorkplan(context.inputArtifacts.parsed_implementation_workplan);
    const currentExecutionPointer = this.parseCurrentExecutionPointer(context.inputArtifacts.current_step);
    const currentBatch = this.resolveCurrentBatch(parsedWorkplan, currentExecutionPointer);
    const moduleDesignDocuments = await this.loadModuleDesignDocuments(context);

    return {
      ...context,
      inputArtifacts: {
        ...context.inputArtifacts,
        prepared_step_context: JSON.stringify({
          workplanRef: implementationWorkplanRef,
          workplan: parsedWorkplan,
          currentBatch,
          upstreamContext: {
            requirementDocument: context.inputArtifacts.requirement_document,
            architectureDocument: context.inputArtifacts.architecture_document,
            moduleDesignDocuments,
          },
        }),
      },
    };
  }

  private parsePreparedStepContext(rawPreparedStepContext: string | undefined): PreparedStepContext {
    if (!rawPreparedStepContext) {
      throw new Error('Missing required input artifact "prepared_step_context".');
    }

    return JSON.parse(rawPreparedStepContext) as PreparedStepContext;
  }

  private parseCurrentExecutionPointer(rawCurrentStep: string | undefined): CurrentExecutionPointer {
    if (!rawCurrentStep?.trim()) {
      throw new Error('Missing required input artifact "current_step".');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawCurrentStep);
    } catch {
      throw new Error('Input artifact "current_step" must be valid JSON with { stepId, batchId }.');
    }

    if (
      !parsed
      || typeof parsed !== "object"
      || typeof (parsed as { stepId?: unknown }).stepId !== "string"
      || (parsed as { stepId: string }).stepId.trim().length === 0
      || typeof (parsed as { batchId?: unknown }).batchId !== "string"
      || (parsed as { batchId: string }).batchId.trim().length === 0
    ) {
      throw new Error('Input artifact "current_step" must be valid JSON with { stepId, batchId }.');
    }

    return {
      stepId: (parsed as { stepId: string }).stepId,
      batchId: (parsed as { batchId: string }).batchId,
    };
  }

  private async persistAcceptedArtifacts(context: StageRunContext, changedFiles: ChangedFile[]): Promise<void> {
    void context;
    void changedFiles;
  }

  private async updateAcceptedImplementationWorkplan(
    context: StageRunContext,
    preparedStepContext: PreparedStepContext,
  ): Promise<void> {
    const workplanPath = path.join(context.workspaceRoot, preparedStepContext.workplanRef);
    const workplanContent = await readFile(workplanPath, "utf8");
    const updatedContent = this.markAcceptedBatch(workplanContent, preparedStepContext.currentBatch.batchId);
    await writeFile(workplanPath, updatedContent, "utf8");
  }

  private markAcceptedBatch(workplanContent: string, batchId: string): string {
    const heading = "## 4. Implementation Execution State";
    const acceptedLine = `- [x] ${batchId}`;
    const pendingLinePattern = new RegExp(`^- \\[ \\] ${this.escapeForRegExp(batchId)}$`, "m");
    const acceptedLinePattern = new RegExp(`^- \\[x\\] ${this.escapeForRegExp(batchId)}$`, "m");

    if (acceptedLinePattern.test(workplanContent)) {
      return workplanContent;
    }

    if (pendingLinePattern.test(workplanContent)) {
      return workplanContent.replace(pendingLinePattern, acceptedLine);
    }

    if (!workplanContent.includes(heading)) {
      return `${workplanContent.trimEnd()}\n\n${heading}\n${acceptedLine}\n`;
    }

    return workplanContent.replace(heading, `${heading}\n${acceptedLine}`);
  }

  private parseStructuredWorkplan(rawStructuredWorkplan: string | undefined): ImplementationWorkPlan {
    if (!rawStructuredWorkplan) {
      throw new Error('Missing required input artifact "parsed_implementation_workplan".');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawStructuredWorkplan);
    } catch {
      throw new Error('Input artifact "parsed_implementation_workplan" must be valid JSON.');
    }

    if (
      !parsed
      || typeof parsed !== "object"
      || !Array.isArray((parsed as { steps?: unknown }).steps)
      || (parsed as { steps: unknown[] }).steps.length === 0
    ) {
      throw new Error('Input artifact "parsed_implementation_workplan" must contain a non-empty workplan structure.');
    }

    return parsed as ImplementationWorkPlan;
  }

  private resolveCurrentBatch(workplan: ImplementationWorkPlan, currentStep: CurrentExecutionPointer): ImplementationWorkPlanBatch {
    const step = workplan.steps.find((entry) => entry.stepId === currentStep.stepId);
    if (!step) {
      throw new Error(`Current execution step "${currentStep.stepId}" was not found in parsed implementation workplan.`);
    }

    const batch = step.batches.find((entry) => entry.batchId === currentStep.batchId);
    if (!batch) {
      throw new Error(`Current execution batch "${currentStep.batchId}" was not found in parsed implementation workplan.`);
    }

    return batch;
  }

  private resolveNextCurrentStep(
    workplan: ImplementationWorkPlan,
    currentBatchId: string,
    rawCurrentStep: string | undefined,
  ): CurrentExecutionPointer | null {
    const currentPointer = this.parseCurrentExecutionPointer(rawCurrentStep);
    const stepIndex = workplan.steps.findIndex((step) => step.stepId === currentPointer.stepId);
    if (stepIndex < 0) {
      throw new Error(`Current execution step "${currentPointer.stepId}" was not found in parsed implementation workplan.`);
    }

    const step = workplan.steps[stepIndex] as ImplementationWorkPlanStep;
    const batchIndex = step.batches.findIndex((batch) => batch.batchId === currentBatchId);
    if (batchIndex < 0) {
      throw new Error(`Current execution batch "${currentBatchId}" was not found in parsed implementation workplan.`);
    }

    const nextBatch = step.batches[batchIndex + 1];
    if (nextBatch) {
      return {
        stepId: step.stepId,
        batchId: nextBatch.batchId,
      };
    }

    const nextStep = workplan.steps[stepIndex + 1];
    const firstNextBatch = nextStep?.batches[0];
    if (nextStep && firstNextBatch) {
      return {
        stepId: nextStep.stepId,
        batchId: firstNextBatch.batchId,
      };
    }

    return null;
  }

  private escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async recordFinalStepResult(
    context: StageRunContext,
    batchId: string,
    changedFiles: ChangedFile[],
  ): Promise<void> {
    await this.traceRecorder?.recordTrace({
      caller: "ImplementationStageRunner.recordFinalStepResult",
      taskId: context.taskId,
      stageId: context.stageId,
      eventType: TRACE_EVENT_TYPES.stepCompleted,
      summary: `Implementation batch "${batchId}" completed and accepted.`,
      metadata: {
        batchId,
        changedFileCount: String(changedFiles.length),
      },
    });
  }

  private async loadModuleDesignDocuments(
    context: StageRunContext,
  ): Promise<Array<{ moduleName: string; content: string }>> {
    const rawModuleDesignDocuments = context.inputArtifacts.module_design_documents;
    if (!rawModuleDesignDocuments) {
      throw new Error('Missing required input artifact "module_design_documents".');
    }

    let moduleDesignRefs: unknown;
    try {
      moduleDesignRefs = JSON.parse(rawModuleDesignDocuments);
    } catch {
      throw new Error('Input artifact "module_design_documents" must be valid JSON.');
    }

    if (!Array.isArray(moduleDesignRefs)
      || moduleDesignRefs.length === 0
      || moduleDesignRefs.some((entry) => typeof entry !== "string" || entry.length === 0)) {
      throw new Error('Input artifact "module_design_documents" must contain a non-empty string array.');
    }

    return Promise.all(
      moduleDesignRefs.map(async (filePath) => ({
        moduleName: path.basename(filePath, path.extname(filePath)),
        content: await readFile(path.join(context.workspaceRoot, filePath), "utf8"),
      })),
    );
  }
}
