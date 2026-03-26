import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type {
  IExecutionUnitGenerator,
  WorkExecuteArtifacts,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import type { ArtifactMap, ExternalAction, ProjectFile } from "../../Runtime/Schema/runtime.js";
import type { ApplyResult, ParsedGenerationResult, PreparedStepContext, ProjectContext, PromptBuildInput } from "./types.js";

export interface WorkExecuteGeneratorDependencies {
  llmExecutor: ILlmExecutor;
}

export class WorkExecuteGenerator implements IExecutionUnitGenerator<ExecutionUnitResult<WorkExecuteArtifacts>> {
  private static readonly EXCLUDED_DIRECTORIES = new Set([".git", "artifact_store", "dist", "node_modules"]);
  private static readonly MAX_FILE_COUNT = 50;
  private static readonly MAX_FILE_SIZE_BYTES = 64 * 1024;

  constructor(private readonly llmExecutor: ILlmExecutor) {}

  async run(context: ExecutionContext): Promise<ExecutionUnitResult<WorkExecuteArtifacts>> {
    const preparedStepContext = this.loadPreparedStepContext(context.inputArtifacts);
    const projectContext = await this.loadProjectContext(context);
    const request = this.buildPrompt({ preparedStepContext, projectContext });
    const llmResult = await this.llmExecutor.execute(request);
    const generatedChanges = this.parseGeneratedChanges(context.workspaceRoot, llmResult);
    return this.buildExecutionUnitResult(context.executionUnitId, generatedChanges);
  }

  private loadPreparedStepContext(inputArtifacts: ArtifactMap): PreparedStepContext {
    const rawPreparedStepContext = inputArtifacts.prepared_step_context;
    if (!rawPreparedStepContext) {
      throw new Error('Missing required input artifact "prepared_step_context".');
    }

    const preparedStepContext = this.parseJsonText<unknown>(
      rawPreparedStepContext,
      'Input artifact "prepared_step_context" must be valid JSON.',
    );

    if (!this.isPreparedStepContext(preparedStepContext)) {
      throw new Error('Input artifact "prepared_step_context" has an invalid structure.');
    }

    return preparedStepContext;
  }

  private isPreparedStepContext(value: unknown): value is PreparedStepContext {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<PreparedStepContext>;
    return Boolean(
      typeof candidate.workplanRef === "string"
      && candidate.workplanRef.length > 0
      && candidate.workplan
      && Array.isArray(candidate.workplan.steps)
      && candidate.workplan.steps.length > 0
      && candidate.currentBatch
      && typeof candidate.currentBatch.batchId === "string"
      && candidate.currentBatch.batchId.length > 0
      && typeof candidate.currentBatch.title === "string"
      && candidate.currentBatch.title.length > 0
      && Array.isArray(candidate.currentBatch.tasks)
      && candidate.upstreamContext
      && typeof candidate.upstreamContext.requirementDocument === "string"
      && candidate.upstreamContext.requirementDocument.length > 0
      && typeof candidate.upstreamContext.architectureDocument === "string"
      && candidate.upstreamContext.architectureDocument.length > 0
      && Array.isArray(candidate.upstreamContext.itemDesignDocuments)
      && candidate.upstreamContext.itemDesignDocuments.length > 0
      && candidate.upstreamContext.itemDesignDocuments.every(
        (entry) => entry
          && typeof entry.itemName === "string"
          && entry.itemName.length > 0
          && typeof entry.content === "string"
          && entry.content.length > 0,
      )
    );
  }

  private async loadProjectContext(context: ExecutionContext): Promise<ProjectContext> {
    const relevantFiles = await this.collectProjectFiles(context.workspaceRoot);
    return {
      rootPath: context.workspaceRoot,
      relevantFiles,
    };
  }

  private async collectProjectFiles(workspaceRoot: string): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    await this.walkDirectory(workspaceRoot, workspaceRoot, files);
    return files;
  }

  private async walkDirectory(
    workspaceRoot: string,
    currentDirectory: string,
    collected: ProjectFile[],
  ): Promise<void> {
    let entries;

    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      if (collected.length >= WorkExecuteGenerator.MAX_FILE_COUNT) {
        return;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(workspaceRoot, absolutePath);

      if (entry.isDirectory()) {
        if (WorkExecuteGenerator.EXCLUDED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await this.walkDirectory(workspaceRoot, absolutePath, collected);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const content = await this.readProjectFile(absolutePath);
      if (content === null) {
        continue;
      }

      collected.push({
        path: relativePath,
        content,
      });
    }
  }

  private async readProjectFile(absolutePath: string): Promise<string | null> {
    const content = await readFile(absolutePath, "utf8");
    if (Buffer.byteLength(content, "utf8") > WorkExecuteGenerator.MAX_FILE_SIZE_BYTES) {
      return null;
    }

    return content;
  }

  private buildPrompt(input: PromptBuildInput): LlmExecutionRequest {
    return {
      prompt: {
        systemPrompt:
          "You generate one external execution prompt for workspace changes. " +
          "Return JSON with summary and prompt only.",
        userPrompt: {
          target: "work_execute",
          workplanRef: input.preparedStepContext.workplanRef,
          workplan: input.preparedStepContext.workplan,
          currentBatch: input.preparedStepContext.currentBatch,
          upstreamContext: input.preparedStepContext.upstreamContext,
          projectContext: {
            rootPath: input.projectContext.rootPath,
            relevantFiles: input.projectContext.relevantFiles,
          },
          requiredOutputShape: {
            summary: "string",
            prompt: "string",
          },
        },
      },
      responseFormat: "json",
      metadata: {
        executionUnit: "work_execute",
      },
    };
  }

  private parseGeneratedChanges(workspaceRoot: string, result: LlmExecutionResult): ApplyResult {
    const parsed = this.parseGeneratedChangesPayload(result.content);
    const prompt = this.readStringValue(
      parsed?.prompt,
      parsed?.execution_prompt,
      parsed?.instruction,
      parsed?.message,
    );

    if (!prompt) {
      throw new Error("Work execute result must include a prompt string.");
    }

    return {
      summary: this.readStringValue(parsed?.summary, parsed?.description) ?? "Work execute prompt generated.",
      prompt,
      action: this.buildExternalAction(workspaceRoot, prompt),
    };
  }

  private buildExternalAction(workspaceRoot: string, prompt: string): ExternalAction {
    return {
      tool: "external_execution",
      operation: "apply_workspace_change",
      targetPath: workspaceRoot,
      payload: {
        prompt,
      },
    };
  }

  private parseGeneratedChangesPayload(content: string): Record<string, unknown> | undefined {
    const direct = this.tryParseJsonText<Record<string, unknown>>(content);
    if (direct) {
      return direct;
    }

    const fencedMatch = content.match(/```json\s*([\s\S]*?)\s*```/i) ?? content.match(/```\s*([\s\S]*?)\s*```/);
    if (fencedMatch?.[1]) {
      return this.tryParseJsonText<Record<string, unknown>>(fencedMatch[1]);
    }

    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      return this.tryParseJsonText<Record<string, unknown>>(objectMatch[0]);
    }

    return undefined;
  }

  private readStringValue(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private buildExecutionUnitResult(
    executionUnitId: string,
    result: ApplyResult,
  ): ExecutionUnitResult<WorkExecuteArtifacts> {
    return {
      executionUnitId,
      success: true,
      summary: result.summary,
      artifacts: {
        prompt: result.prompt,
        action: result.action,
        summary: result.summary,
      },
    };
  }

  private parseJsonText<T>(content: string, invalidMessage: string): T {
    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(invalidMessage);
    }
  }

  private tryParseJsonText<T>(content: string): T | undefined {
    try {
      return JSON.parse(content) as T;
    } catch {
      return undefined;
    }
  }
}
