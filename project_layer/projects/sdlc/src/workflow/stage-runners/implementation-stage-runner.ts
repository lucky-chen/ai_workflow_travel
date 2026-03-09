// Implementation stage runner: executes implementation generation, contract check, review, and final apply.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { IContractChecker, IStageGenerator, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ImplementationStageArtifacts } from "../../shared/contracts/pipeline.js";
import { ChangeApplier } from "../../execution/implementation-generator/change-applier.js";
import { BaseStageRunner, type BaseStageRunnerDependencies } from "./base-stage-runner.js";
import {
  GitProcessCommitter,
  type IImplementationGitCommitter,
} from "./implementation-git-committer.js";
import type { PreparedStepContext } from "../../execution/implementation-generator/types.js";
import type { ImplementationWorkPlan, ImplementationWorkPlanBatch } from "../../shared/contracts/implementation-workplan.js";

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

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    this.validateExecutionContext(context);
    await this.recordStageStart(context);

    const preparedContext = await this.prepareExecutionContext(context);
    const preparedStepContext = this.parsePreparedStepContext(preparedContext.inputArtifacts.prepared_step_context);
    const output = await this.dependencies.generator.run(preparedContext);
    await this.changeApplier.applyChangedFiles(output.artifacts.changedFiles, context.workspaceRoot);

    const contractResult = await this.runContractCheck(this.dependencies.contractChecker, context, output);
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

    await this.updateAcceptedImplementationWorkplan(context, preparedStepContext);
    await this.gitCommitter.commit({
      workspaceRoot: context.workspaceRoot,
      stepId: preparedStepContext.currentBatch.batchId,
    });

    return output;
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
    if (!this.artifactStore) {
      throw new Error("ImplementationStageRunner requires an artifactStore for execution-context loading.");
    }

    const implementationWorkplanRef = context.inputArtifacts.implementation_workplan.trim();
    const parsedWorkplan = this.parseStructuredWorkplan(context.inputArtifacts.parsed_implementation_workplan);
    const currentBatch = this.resolveCurrentBatch(parsedWorkplan, context.inputArtifacts.current_step.trim());
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

  private async updateAcceptedImplementationWorkplan(
    context: StageRunContext,
    preparedStepContext: PreparedStepContext,
  ): Promise<void> {
    if (!this.artifactStore) {
      throw new Error("ImplementationStageRunner requires an artifactStore to update implementation workplan state.");
    }

    const workplanContent = await this.artifactStore.getArtifact({
      taskId: context.taskId,
      stageId: "implementation_plan",
      filePath: preparedStepContext.workplanRef,
    });
    const updatedContent = this.markAcceptedBatch(workplanContent, preparedStepContext.currentBatch.batchId);
    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      stageId: "implementation_plan",
      filePath: preparedStepContext.workplanRef,
      content: updatedContent,
    });

    const workspacePlanPath = path.join(context.workspaceRoot, preparedStepContext.workplanRef);
    await mkdir(path.dirname(workspacePlanPath), { recursive: true });
    await writeFile(workspacePlanPath, updatedContent, "utf8");
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

  private resolveCurrentBatch(workplan: ImplementationWorkPlan, rawCurrentStep: string): ImplementationWorkPlanBatch {
    let stepId = rawCurrentStep;
    let batchId: string | undefined;

    try {
      const parsed = JSON.parse(rawCurrentStep) as { stepId?: unknown; batchId?: unknown };
      if (typeof parsed.stepId === "string" && parsed.stepId.length > 0) {
        stepId = parsed.stepId;
      }
      if (typeof parsed.batchId === "string" && parsed.batchId.length > 0) {
        batchId = parsed.batchId;
      }
    } catch {
      // Fallback to plain step id string.
    }

    const step = workplan.steps.find((entry) => entry.stepId === stepId);
    if (!step) {
      throw new Error(`Current execution step "${stepId}" was not found in parsed implementation workplan.`);
    }

    const batch = batchId
      ? step.batches.find((entry) => entry.batchId === batchId)
      : step.batches[0];
    if (!batch) {
      throw new Error(`Current execution batch "${batchId ?? "<first>"}" was not found in parsed implementation workplan.`);
    }

    return batch;
  }

  private escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        content: await this.artifactStore!.getArtifact({
          taskId: context.taskId,
          stageId: "module_design",
          filePath,
        }),
      })),
    );
  }
}
