import { ArtifactStoreService } from "../data/artifact-store.js";
import { HistoryStoreService } from "../data/history-store.js";
import { ImplementationContract } from "../contract/implementation-contract.js";
import { ImplementationGenerator } from "../execution/implementation-generator/implementation-generator.js";
import { InMemoryChangeGate } from "../quality-gate/change-gate.js";
import { TraceService } from "../quality-gate/trace-recorder.js";
import {
  LlmExecutorService,
  type ILlmExecutor,
  type LlmExecutorServiceDependencies,
} from "../sdk/llm-executor/llm-executor.js";
import type { StageDefinition } from "../shared/contracts/pipeline.js";
import { PipelineService } from "../workflow/pipeline/pipeline.js";
import { StageRegistry } from "../workflow/pipeline/stage-registry.js";
import { createModuleDesignFanoutContinuation } from "../workflow/pipeline/module-design-fanout.js";
import { TaskRuntimeStore } from "../workflow/pipeline/task-runtime-store.js";
import { ArchitectureStageRunner } from "../workflow/stage-runners/architecture-stage-runner.js";
import { ImplementationPlanStageRunner } from "../workflow/stage-runners/implementation-plan-stage-runner.js";
import type { IImplementationGitCommitter } from "../workflow/stage-runners/implementation-git-committer.js";
import { ImplementationStageRunner } from "../workflow/stage-runners/implementation-stage-runner.js";
import { ModuleStageRunner } from "../workflow/stage-runners/module-stage-runner.js";
import { OverallDesignContractRunner } from "../workflow/stage-runners/overall-design-contract-runner.js";
import { RequirementStageRunner } from "../workflow/stage-runners/requirement-stage-runner.js";
import { ValidationStageRunner } from "../workflow/stage-runners/validation-stage-runner.js";
import { ShellRunner } from "../workflow/shell-runner.js";
import {
  ContractResultBuilder,
  DefaultExecutionEnvironmentPreparer,
  ShellCommandTestRunner,
} from "../contract/implementation-contract.js";

export interface ApplicationServices {
  artifactStore: ArtifactStoreService;
  historyStore: HistoryStoreService;
  traceRecorder: TraceService;
  changeGate: InMemoryChangeGate;
  llmExecutor: ILlmExecutor;
}

export interface CompositionRootOptions {
  artifactStorageRoot?: string;
  historyStorageRoot?: string;
  llmExecutor?: LlmExecutorServiceDependencies;
  llmExecutorInstance?: ILlmExecutor;
  shellRunner?: ShellRunner;
  gitCommitter?: IImplementationGitCommitter;
  changeGate?: InMemoryChangeGate;
}

export interface ApplicationRuntime {
  services: ApplicationServices;
  registry: StageRegistry;
  pipeline: PipelineService;
}

export function createApplicationServices(options: CompositionRootOptions = {}): ApplicationServices {
  const historyStore = new HistoryStoreService(options.historyStorageRoot);
  const traceRecorder = new TraceService(historyStore);
  const artifactStore = new ArtifactStoreService(options.artifactStorageRoot, traceRecorder);
  const changeGate = options.changeGate ?? new InMemoryChangeGate();

  const llmExecutor = options.llmExecutorInstance ?? new LlmExecutorService({
    ...options.llmExecutor,
    traceRecorder,
  });

  return {
    artifactStore,
    historyStore,
    traceRecorder,
    changeGate,
    llmExecutor,
  };
}

export function createApplicationRuntime(options: CompositionRootOptions = {}): ApplicationRuntime {
  const taskRuntimeStore = new TaskRuntimeStore();
  const services = createApplicationServicesWithTaskRuntimeStore(options, taskRuntimeStore);
  const registry = createDefaultStageRegistry(services, options);
  const pipeline = new PipelineService({
    registry,
    traceRecorder: services.traceRecorder,
    taskRuntimeStore,
  });

  return {
    services,
    registry,
    pipeline,
  };
}

function createApplicationServicesWithTaskRuntimeStore(
  options: CompositionRootOptions,
  taskRuntimeStore: TaskRuntimeStore,
): ApplicationServices {
  const historyStore = new HistoryStoreService(
    options.historyStorageRoot,
    (taskId) => {
      const task = taskRuntimeStore.getTaskRecord(taskId);
      return task
        ? {
            workspaceRoot: task.workspaceRoot,
            runId: task.runId,
          }
        : undefined;
    },
  );
  const traceRecorder = new TraceService(historyStore);
  const artifactStore = new ArtifactStoreService(options.artifactStorageRoot, traceRecorder);
  const changeGate = options.changeGate ?? new InMemoryChangeGate();

  const llmExecutor = options.llmExecutorInstance ?? new LlmExecutorService({
    ...options.llmExecutor,
    traceRecorder,
  });

  return {
    artifactStore,
    historyStore,
    traceRecorder,
    changeGate,
    llmExecutor,
  };
}

export function createDefaultStageRegistry(services: ApplicationServices, options: CompositionRootOptions = {}): StageRegistry {
  const registry = new StageRegistry();

  const requirementStageDefinition: StageDefinition = {
    stageId: "requirement_interpretation",
    launchRequirements: ["requirement_document"],
    runner: new RequirementStageRunner({
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
      llmExecutor: services.llmExecutor,
    }),
    nextStageId: "architecture_design",
  };

  const moduleStageDefinition: StageDefinition = {
    stageId: "module_design",
    launchRequirements: ["architecture_document", "module_descriptors"],
    runner: new ModuleStageRunner({
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
      llmExecutor: services.llmExecutor,
    }),
    nextStageId: "implementation_plan",
  };

  registry.register(requirementStageDefinition);
  registry.register({
    stageId: "architecture_design",
    launchRequirements: ["requirement_document"],
    runner: new ArchitectureStageRunner({
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
      llmExecutor: services.llmExecutor,
    }),
    nextStageId: "module_design",
    continuation: createModuleDesignFanoutContinuation(moduleStageDefinition),
  });
  registry.register(moduleStageDefinition);
  registry.register({
    stageId: "overall_design_contract",
    launchRequirements: ["requirement_document", "architecture_document", "module_design_documents"],
    runner: new OverallDesignContractRunner({
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
    }),
    nextStageId: null,
  });
  registry.register({
    stageId: "implementation_plan",
    launchRequirements: ["requirement_document", "architecture_document", "module_design_documents"],
    runner: new ImplementationPlanStageRunner({
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
      llmExecutor: services.llmExecutor,
    }),
    nextStageId: "implementation_execution",
  });
  registry.register({
    stageId: "implementation_execution",
    launchRequirements: [
      "implementation_workplan",
      "parsed_implementation_workplan",
      "current_step",
      "requirement_document",
      "architecture_document",
      "module_design_documents",
    ],
    runner: new ImplementationStageRunner({
      generator: new ImplementationGenerator({
        llmExecutor: services.llmExecutor,
      }),
      contractChecker: options.shellRunner
        ? new ImplementationContract(
          new DefaultExecutionEnvironmentPreparer(),
          new ShellCommandTestRunner(options.shellRunner),
          new ContractResultBuilder(),
        )
        : ImplementationContract.create(),
      artifactStore: services.artifactStore,
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
      ...(options.gitCommitter ? { gitCommitter: options.gitCommitter } : {}),
    }),
    nextStageId: null,
  });
  registry.register({
    stageId: "validation",
    launchRequirements: [],
    runner: new ValidationStageRunner({
      artifactStore: services.artifactStore,
      traceRecorder: services.traceRecorder,
      changeGate: services.changeGate,
      ...(options.shellRunner ? { shellRunner: options.shellRunner } : {}),
    }),
    nextStageId: null,
  });

  registry.validate();

  return registry;
}
