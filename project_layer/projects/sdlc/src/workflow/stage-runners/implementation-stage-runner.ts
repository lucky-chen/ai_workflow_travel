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

interface PreparedImplementationStepContext {
  workplan: {
    ref: string;
    content: string;
  };
  currentStep: {
    stepId: string;
    raw: string;
  };
  upstreamContext: {
    requirementDocument: string;
    architectureDocument: string;
    moduleDesignDocuments: Array<{ moduleName: string; content: string }>;
  };
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
      stepId: preparedStepContext.currentStep.stepId,
    });

    return output;
  }

  private validateExecutionContext(context: StageRunContext): void {
    const implementationWorkplan = context.inputArtifacts.implementation_workplan?.trim();
    if (!implementationWorkplan) {
      throw new Error('Missing required input artifact "implementation_workplan".');
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
    const implementationWorkplanContent = await this.artifactStore.getArtifact({
      taskId: context.taskId,
      stageId: "implementation_plan",
      filePath: implementationWorkplanRef,
    });

    const currentStep = this.parseCurrentStep(context.inputArtifacts.current_step.trim());
    const moduleDesignDocuments = await this.loadModuleDesignDocuments(context);

    return {
      ...context,
      inputArtifacts: {
        ...context.inputArtifacts,
        prepared_step_context: JSON.stringify({
          workplan: {
            ref: implementationWorkplanRef,
            content: implementationWorkplanContent,
          },
          currentStep,
          upstreamContext: {
            requirementDocument: context.inputArtifacts.requirement_document,
            architectureDocument: context.inputArtifacts.architecture_document,
            moduleDesignDocuments,
          },
        }),
      },
    };
  }

  private parsePreparedStepContext(rawPreparedStepContext: string | undefined): PreparedImplementationStepContext {
    if (!rawPreparedStepContext) {
      throw new Error('Missing required input artifact "prepared_step_context".');
    }

    return JSON.parse(rawPreparedStepContext) as PreparedImplementationStepContext;
  }

  private async updateAcceptedImplementationWorkplan(
    context: StageRunContext,
    preparedStepContext: PreparedImplementationStepContext,
  ): Promise<void> {
    if (!this.artifactStore) {
      throw new Error("ImplementationStageRunner requires an artifactStore to update implementation workplan state.");
    }

    const updatedContent = this.markAcceptedStep(preparedStepContext.workplan.content, preparedStepContext.currentStep.stepId);
    await this.artifactStore.writeArtifact({
      taskId: context.taskId,
      stageId: "implementation_plan",
      filePath: preparedStepContext.workplan.ref,
      content: updatedContent,
    });

    const workspacePlanPath = path.join(context.workspaceRoot, preparedStepContext.workplan.ref);
    await mkdir(path.dirname(workspacePlanPath), { recursive: true });
    await writeFile(workspacePlanPath, updatedContent, "utf8");
  }

  private markAcceptedStep(workplanContent: string, stepId: string): string {
    const heading = "## 4. Implementation Execution State";
    const acceptedLine = `- [x] ${stepId}`;
    const pendingLinePattern = new RegExp(`^- \\[ \\] ${this.escapeForRegExp(stepId)}$`, "m");
    const acceptedLinePattern = new RegExp(`^- \\[x\\] ${this.escapeForRegExp(stepId)}$`, "m");

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

  private escapeForRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private parseCurrentStep(rawCurrentStep: string): { stepId: string; raw: string } {
    try {
      const parsed = JSON.parse(rawCurrentStep) as { stepId?: unknown };
      if (typeof parsed.stepId === "string" && parsed.stepId.length > 0) {
        return {
          stepId: parsed.stepId,
          raw: rawCurrentStep,
        };
      }
    } catch {
      // Fallback to plain step id string.
    }

    return {
      stepId: rawCurrentStep,
      raw: rawCurrentStep,
    };
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
