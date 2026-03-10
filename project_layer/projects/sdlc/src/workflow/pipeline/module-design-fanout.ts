import type {
  IStageContinuationHandler,
  LaunchTaskRequest,
  StageContinuationContext,
  StageContinuationResult,
  StageDefinition,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, TaskId } from "../../shared/types/common.js";
import { parseDesignDocumentBreakdown, type DesignDocumentDescriptor } from "../../shared/architecture/design-document-breakdown.js";

interface ModuleDescriptor {
  name: string;
  responsibilities: string[];
  documentPath?: string;
  description?: string;
}

export interface ModuleDesignFanoutInput {
  taskId: TaskId;
  workspaceRoot: string;
  attempt: number;
  params: LaunchTaskRequest["params"];
  currentInputArtifacts: ArtifactMap;
  architectureOutput: StageOutput;
  moduleStageDefinition: StageDefinition;
}

export function createModuleDesignFanoutContinuation(
  moduleStageDefinition: StageDefinition,
): IStageContinuationHandler {
  return {
    async continue(context: StageContinuationContext): Promise<StageContinuationResult> {
      const mergedArtifacts = context.mergeInputArtifacts(context.inputArtifacts, context.stageOutput);
      const nextInputArtifacts = await runSequentialModuleDesignFanout(
        {
          taskId: context.taskId,
          workspaceRoot: context.workspaceRoot,
          attempt: context.attempt,
          params: context.params,
          currentInputArtifacts: mergedArtifacts,
          architectureOutput: context.stageOutput,
          moduleStageDefinition,
        },
        context,
      );

      return {
        nextInputArtifacts,
        nextStageId: moduleStageDefinition.nextStageId ?? undefined,
      };
    },
  };
}

export async function continueAfterArchitectureDesign(
  input: StageContinuationContext,
  moduleStageDefinition: StageDefinition,
): Promise<StageContinuationResult> {
  const mergedArtifacts = input.mergeInputArtifacts(input.inputArtifacts, input.stageOutput);
  const nextInputArtifacts = await runSequentialModuleDesignFanout(
    {
      taskId: input.taskId,
      workspaceRoot: input.workspaceRoot,
      attempt: input.attempt,
      params: input.params,
      currentInputArtifacts: mergedArtifacts,
      architectureOutput: input.stageOutput,
      moduleStageDefinition,
    },
    input,
  );

  return {
    nextInputArtifacts,
    nextStageId: moduleStageDefinition.nextStageId ?? undefined,
  };
}

export async function runSequentialModuleDesignFanout(
  input: ModuleDesignFanoutInput,
  context: Pick<
    StageContinuationContext,
    "mergeInputArtifacts" | "resolveStageStatus" | "updateTaskAfterStageRun" | "onStageFailure"
  >,
): Promise<ArtifactMap> {
  const moduleDescriptors = readModuleDesignTargets(input.currentInputArtifacts, input.architectureOutput);
  const acceptedModuleDesignPaths: string[] = [];
  let accumulatedArtifacts = input.currentInputArtifacts;

  for (const moduleDescriptor of moduleDescriptors) {
    const moduleContext: StageRunContext = {
      taskId: input.taskId,
      stageId: "module_design",
      attempt: input.attempt,
      workspaceRoot: input.workspaceRoot,
      inputArtifacts: {
        ...accumulatedArtifacts,
        module_descriptors: JSON.stringify(moduleDescriptor),
      },
      params: input.params,
    };

    const moduleOutput = await input.moduleStageDefinition.runner.run(moduleContext);
    context.updateTaskAfterStageRun(moduleContext, moduleOutput);

    if (context.resolveStageStatus(moduleOutput) === "failed") {
      await context.onStageFailure("module_design", moduleContext.inputArtifacts, 'Stage "module_design" failed.');
      throw new Error('Stage "module_design" failed during sequential fan-out.');
    }

    const modulePath = readModuleDesignPath(moduleOutput);
    acceptedModuleDesignPaths.push(modulePath);
    accumulatedArtifacts = context.mergeInputArtifacts(accumulatedArtifacts, moduleOutput);
  }

  const {
    module_design_document: _singleModuleDesignDocument,
    module_descriptors: _moduleDescriptors,
    design_document_breakdown: _designDocumentBreakdown,
    documentPath: _documentPath,
    ...nextArtifacts
  } = accumulatedArtifacts;

  return {
    ...nextArtifacts,
    module_design_documents: JSON.stringify(acceptedModuleDesignPaths),
  };
}

function readArchitectureContent(output: StageOutput): string {
  if (!output.artifacts || typeof output.artifacts !== "object") {
    throw new Error('Architecture stage output must include object artifacts.');
  }

  const content = (output.artifacts as Record<string, unknown>).content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error('Architecture stage output must include non-empty artifacts.content.');
  }

  return content;
}

function readModuleDesignPath(output: StageOutput): string {
  if (!output.artifacts || typeof output.artifacts !== "object") {
    throw new Error('Module-design stage output must include object artifacts.');
  }

  const path = (output.artifacts as Record<string, unknown>).module_design_document;
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new Error('Module-design stage output must include non-empty artifacts.module_design_document.');
  }

  return path;
}

function parseArchitectureModules(content: string): ModuleDescriptor[] {
  const sectionMatch = content.match(/## 5\.2 Core Modules([\s\S]*?)(?:\n## |\n# |$)/);
  if (!sectionMatch) {
    return [];
  }

  return sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2))
    .map((line) => {
      const [rawName, ...rest] = line.split(":");
      const name = rawName.trim();
      const responsibility = rest.join(":").trim();
      return {
        name,
        responsibilities: responsibility.length > 0 ? [responsibility] : ["define module responsibilities from architecture"],
      };
    })
    .filter((entry) => entry.name.length > 0);
}

function readModuleDesignTargets(
  currentInputArtifacts: ArtifactMap,
  architectureOutput: StageOutput,
): ModuleDescriptor[] {
  const serializedBreakdown = readSerializedBreakdown(currentInputArtifacts, architectureOutput);
  if (serializedBreakdown) {
    const parsed = parseSerializedBreakdown(serializedBreakdown);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return parseArchitectureModules(readArchitectureContent(architectureOutput));
}

function readSerializedBreakdown(currentInputArtifacts: ArtifactMap, architectureOutput: StageOutput): string | null {
  const fromOutput = typeof (architectureOutput.artifacts as Record<string, unknown>)?.design_document_breakdown === "string"
    ? String((architectureOutput.artifacts as Record<string, unknown>).design_document_breakdown)
    : null;
  if (fromOutput?.trim()) {
    return fromOutput;
  }

  const fromInput = currentInputArtifacts.design_document_breakdown;
  return fromInput?.trim() ? fromInput : null;
}

function parseSerializedBreakdown(serializedBreakdown: string): ModuleDescriptor[] {
  try {
    const parsed = JSON.parse(serializedBreakdown) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is DesignDocumentDescriptor => {
        if (!entry || typeof entry !== "object") {
          return false;
        }

        const candidate = entry as Record<string, unknown>;
        return typeof candidate.name === "string"
          && typeof candidate.documentPath === "string"
          && typeof candidate.description === "string"
          && Array.isArray(candidate.responsibilities)
          && candidate.responsibilities.every((item) => typeof item === "string");
      })
      .map((entry) => ({
        name: entry.name,
        documentPath: entry.documentPath,
        description: entry.description,
        responsibilities: entry.responsibilities,
      }));
  } catch {
    return [];
  }
}
