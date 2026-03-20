import {
  ArchitectureDesignContractRuntimeUnit,
} from "../../Capability/ArchitectureDesign/architecture-design-contract.js";
import {
  ArchitectureDesignGenerateRuntimeUnit,
} from "../../Capability/ArchitectureDesign/architecture-design-generator.js";
import { ArchitectureDesignUpdateRuntimeUnit } from "../../Capability/ArchitectureDesign/architecture-design-update-runtime-unit.js";
import {
  ItemDesignContractRuntimeUnit,
} from "../../Capability/ItemDesign/item-design-contract.js";
import {
  ItemDesignGenerateRuntimeUnit,
} from "../../Capability/ItemDesign/item-design-generator.js";
import { ItemDesignUpdateRuntimeUnit } from "../../Capability/ItemDesign/item-design-update-runtime-unit.js";
import { OverallDesignContractRuntimeUnit } from "../../Capability/OverallDesignContract/overall-design-contract-runtime-unit.js";
import {
  RequirementDesignContractRuntimeUnit,
} from "../../Capability/RequirementDesign/requirement-contract.js";
import {
  RequirementDesignGenerateRuntimeUnit,
} from "../../Capability/RequirementDesign/requirement-generator.js";
import { RequirementDesignUpdateRuntimeUnit } from "../../Capability/RequirementDesign/requirement-update-runtime-unit.js";
import { WorkExecuteRuntimeUnit } from "../../Capability/WorkExecute/work-execute-runtime-unit.js";
import {
  WorkPlanContractRuntimeUnit,
} from "../../Capability/WorkPlan/work-plan-contract.js";
import {
  WorkPlanGenerateRuntimeUnit,
} from "../../Capability/WorkPlan/work-plan-generator.js";
import { WorkPlanUpdateRuntimeUnit } from "../../Capability/WorkPlan/work-plan-update-runtime-unit.js";
import type { RuntimeInput, RuntimeResult } from "../Schema/runtime.js";
import type { Orchestrator, RuntimeOrchestratorDependencies, RuntimeUnit } from "./types.js";

export class RuntimeOrchestrator implements Orchestrator {
  private readonly unitRegistry: ReadonlyMap<string, RuntimeUnit>;

  constructor(private readonly dependencies: RuntimeOrchestratorDependencies) {
    this.unitRegistry = this.createUnitRegistry();
  }

  async run(input: RuntimeInput): Promise<RuntimeResult> {
    this.dependencies.traceService?.setScope({
      taskId: input.context.runId,
      runId: input.context.runId,
    });

    if (input.request.mode === "unit") {
      return this.runUnit(input.request, input.context);
    }

    throw new Error("Compose-run is not implemented yet. Only the runtime orchestration boundary is available.");
  }

  private async runUnit(
    request: Extract<RuntimeInput["request"], { mode: "unit" }>,
    contextInput: RuntimeInput["context"],
  ): Promise<RuntimeResult> {
    const unit = this.unitRegistry.get(request.executionUnitId);
    if (unit) {
      return unit.run(request, contextInput);
    }

    throw new Error(`Unsupported execution unit: ${request.executionUnitId}`);
  }

  private createUnitRegistry(): ReadonlyMap<string, RuntimeUnit> {
    const requirementDesignGenerateUnit = new RequirementDesignGenerateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const requirementDesignUpdateUnit = new RequirementDesignUpdateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const requirementDesignContractUnit = new RequirementDesignContractRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const architectureDesignGenerateUnit = new ArchitectureDesignGenerateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const architectureDesignUpdateUnit = new ArchitectureDesignUpdateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const architectureDesignContractUnit = new ArchitectureDesignContractRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const itemDesignGenerateUnit = new ItemDesignGenerateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const itemDesignUpdateUnit = new ItemDesignUpdateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const itemDesignContractUnit = new ItemDesignContractRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const workPlanGenerateUnit = new WorkPlanGenerateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const workPlanUpdateUnit = new WorkPlanUpdateRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const workPlanContractUnit = new WorkPlanContractRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const overallDesignContractUnit = new OverallDesignContractRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
    );
    const workExecuteUnit = new WorkExecuteRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );

    return new Map<string, RuntimeUnit>([
      ["requirement_design_generate", requirementDesignGenerateUnit],
      ["requirement_design_update", requirementDesignUpdateUnit],
      ["requirement_design_contract", requirementDesignContractUnit],
      ["architecture_design_generate", architectureDesignGenerateUnit],
      ["architecture_design_update", architectureDesignUpdateUnit],
      ["architecture_design_contract", architectureDesignContractUnit],
      ["item_design_generate", itemDesignGenerateUnit],
      ["item_design_update", itemDesignUpdateUnit],
      ["item_design_contract", itemDesignContractUnit],
      ["overall_design_contract", overallDesignContractUnit],
      ["work_plan_generate", workPlanGenerateUnit],
      ["work_plan_update", workPlanUpdateUnit],
      ["work_plan_contract", workPlanContractUnit],
      ["work_execute", workExecuteUnit],
      ["work_execute_contract", workExecuteUnit],
    ]);
  }
}
