import type { LaunchTaskRequest, StageDefinition, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap, StageId, TaskId } from "../../shared/types/common.js";

interface ModuleDescriptor {
  name: string;
  responsibilities: string[];
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

export interface ModuleDesignFanoutDependencies {
  mergeInputArtifacts: (current: ArtifactMap, output: StageOutput) => ArtifactMap;
  resolveStageStatus: (output: StageOutput) => "completed" | "failed";
  updateTaskAfterModuleRun: (context: StageRunContext, output: StageOutput) => void;
  onModuleStageFailure: (taskId: TaskId) => Promise<void>;
}

export interface ModuleDesignContinuationInput {
  currentStageId: StageId;
  nextStageId: StageId | null | undefined;
  taskId: TaskId;
  workspaceRoot: string;
  attempt: number;
  params: LaunchTaskRequest["params"];
  currentInputArtifacts: ArtifactMap;
  stageOutput: StageOutput;
  moduleStageDefinition?: StageDefinition;
}

export interface ModuleDesignContinuationResult {
  matched: boolean;
  nextInputArtifacts: ArtifactMap;
  nextStageId?: StageId;
}

export async function continueAfterArchitectureDesign(
  input: ModuleDesignContinuationInput,
  dependencies: ModuleDesignFanoutDependencies,
): Promise<ModuleDesignContinuationResult> {
  if (input.currentStageId !== "architecture_design" || input.nextStageId !== "module_design") {
    return {
      matched: false,
      nextInputArtifacts: input.currentInputArtifacts,
    };
  }

  if (!input.moduleStageDefinition) {
    throw new Error('No stage definition registered for stageId "module_design".');
  }

  const mergedArtifacts = dependencies.mergeInputArtifacts(input.currentInputArtifacts, input.stageOutput);
  const nextInputArtifacts = await runSequentialModuleDesignFanout(
    {
      taskId: input.taskId,
      workspaceRoot: input.workspaceRoot,
      attempt: input.attempt,
      params: input.params,
      currentInputArtifacts: mergedArtifacts,
      architectureOutput: input.stageOutput,
      moduleStageDefinition: input.moduleStageDefinition,
    },
    dependencies,
  );

  return {
    matched: true,
    nextInputArtifacts,
    nextStageId: input.moduleStageDefinition.nextStageId ?? undefined,
  };
}

export async function runSequentialModuleDesignFanout(
  input: ModuleDesignFanoutInput,
  dependencies: ModuleDesignFanoutDependencies,
): Promise<ArtifactMap> {
  const architectureContent = readArchitectureContent(input.architectureOutput);
  const moduleDescriptors = parseArchitectureModules(architectureContent);
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
    dependencies.updateTaskAfterModuleRun(moduleContext, moduleOutput);

    if (dependencies.resolveStageStatus(moduleOutput) === "failed") {
      await dependencies.onModuleStageFailure(input.taskId);
      throw new Error('Stage "module_design" failed during sequential fan-out.');
    }

    const modulePath = readModuleDesignPath(moduleOutput);
    acceptedModuleDesignPaths.push(modulePath);
    accumulatedArtifacts = dependencies.mergeInputArtifacts(accumulatedArtifacts, moduleOutput);
  }

  const {
    module_design_document: _singleModuleDesignDocument,
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
