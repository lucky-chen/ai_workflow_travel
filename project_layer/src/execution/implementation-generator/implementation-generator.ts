import type { IArtifactStore } from "../../shared/contracts/artifact-store.js";
import type {
  ILlmExecutor,
  LlmExecutionRequest,
  LlmExecutionResult,
} from "../../shared/contracts/llm-executor.js";
import type {
  IStageGenerator,
  ImplementationStageArtifacts,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { ArtifactRef, ChangedFile, ProjectFile } from "../../shared/types/common.js";

export interface ModuleDesignDoc {
  content: string;
}

export interface ProjectContext {
  rootPath: string;
  relevantFiles: ProjectFile[];
}

export interface PromptBuildInput {
  moduleDesignDoc: ModuleDesignDoc;
  projectContext: ProjectContext;
}

export interface ApplyResult {
  changedFiles: ChangedFile[];
  summary: string;
}

export class ModuleDesignLoader {
  constructor(private readonly artifactStore: IArtifactStore) {}

  async loadModuleDesign(context: StageRunContext): Promise<ModuleDesignDoc> {
    const ref = this.resolveRef(context.inputArtifacts);
    const content = await this.artifactStore.getArtifact({
      taskId: context.taskId,
      stageId: context.stageId,
      filePath: ref,
    });

    return { content };
  }

  private resolveRef(inputArtifacts: Record<string, ArtifactRef>): ArtifactRef {
    return inputArtifacts.moduleDesign ?? inputArtifacts.module_design ?? "";
  }
}

export class ProjectContextLoader {
  async loadProjectContext(context: StageRunContext): Promise<ProjectContext> {
    return {
      rootPath: context.workspaceRoot,
      relevantFiles: [],
    };
  }
}

export class ImplementationPromptBuilder {
  build(input: PromptBuildInput): LlmExecutionRequest {
    return {
      prompt: {
        systemPrompt:
          "You are generating concrete project file changes. Return explicit changed_files and summary only.",
        userPrompt: JSON.stringify(input, null, 2),
      },
    };
  }
}

export class ChangeApplier {
  async apply(result: LlmExecutionResult, _context: ProjectContext): Promise<ApplyResult> {
    const parsed = this.parseResult(result);
    return {
      changedFiles: parsed.changedFiles,
      summary: parsed.summary,
    };
  }

  private parseResult(result: LlmExecutionResult): ApplyResult {
    try {
      const parsed = JSON.parse(result.content) as {
        summary?: string;
        changed_files?: Array<{ path: string; operation: ChangedFile["operation"]; content?: string }>;
      };

      return {
        summary: parsed.summary ?? "Implementation changes generated.",
        changedFiles: (parsed.changed_files ?? []).map((file) => ({
          path: file.path,
          operation: file.operation,
          content: file.content,
        })),
      };
    } catch {
      return {
        summary: "Implementation changes generated.",
        changedFiles: [],
      };
    }
  }
}

export class StageOutputBuilder {
  build(stageId: string, result: ApplyResult): StageOutput<ImplementationStageArtifacts> {
    return {
      stageId,
      success: true,
      summary: result.summary,
      artifacts: {
        changedFiles: result.changedFiles,
        summary: result.summary,
      },
    };
  }
}

export class ImplementationGeneratorService {
  constructor(
    private readonly moduleDesignLoader: ModuleDesignLoader,
    private readonly projectContextLoader: ProjectContextLoader,
    private readonly promptBuilder: ImplementationPromptBuilder,
    private readonly llmExecutor: ILlmExecutor,
    private readonly changeApplier: ChangeApplier,
    private readonly outputBuilder: StageOutputBuilder,
  ) {}

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    const moduleDesignDoc = await this.moduleDesignLoader.loadModuleDesign(context);
    const projectContext = await this.projectContextLoader.loadProjectContext(context);
    const request = this.promptBuilder.build({ moduleDesignDoc, projectContext });
    const llmResult = await this.llmExecutor.execute(request);
    const applyResult = await this.changeApplier.apply(llmResult, projectContext);
    return this.outputBuilder.build(context.stageId, applyResult);
  }
}

export class ImplementationGenerator implements IStageGenerator {
  constructor(private readonly service: ImplementationGeneratorService) {}

  async run(context: StageRunContext): Promise<StageOutput<ImplementationStageArtifacts>> {
    return this.service.run(context);
  }
}
