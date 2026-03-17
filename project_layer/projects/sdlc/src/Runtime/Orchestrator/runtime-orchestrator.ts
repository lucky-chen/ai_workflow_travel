import { ArchitectureDesignRuntimeUnit } from "../../Capability/ArchitectureDesign/architecture-design-runtime-unit.js";
import { ItemDesignRuntimeUnit } from "../../Capability/ItemDesign/item-design-runtime-unit.js";
import { OverallDesignContractRuntimeUnit } from "../../Capability/OverallDesignContract/overall-design-contract-runtime-unit.js";
import { RequirementDesignRuntimeUnit } from "../../Capability/RequirementDesign/requirement-runtime-unit.js";
import { WorkExecuteRuntimeUnit } from "../../Capability/WorkExecute/work-execute-runtime-unit.js";
import { WorkPlanRuntimeUnit } from "../../Capability/WorkPlan/work-plan-runtime-unit.js";
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
    const requirementDesignUnit = new RequirementDesignRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const architectureDesignUnit = new ArchitectureDesignRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const itemDesignUnit = new ItemDesignRuntimeUnit(
      this.dependencies.artifactStore,
      this.dependencies.traceRecorder,
      this.dependencies.llmExecutor,
      this.dependencies.resourceRoot,
    );
    const workPlanUnit = new WorkPlanRuntimeUnit(
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
      ["requirement_design_generate", requirementDesignUnit],
      ["requirement_design_update", requirementDesignUnit],
      ["requirement_design_contract", requirementDesignUnit],
      ["architecture_design_generate", architectureDesignUnit],
      ["architecture_design_update", architectureDesignUnit],
      ["architecture_design_contract", architectureDesignUnit],
      ["item_design_generate", itemDesignUnit],
      ["item_design_update", itemDesignUnit],
      ["item_design_contract", itemDesignUnit],
      ["overall_design_contract", overallDesignContractUnit],
      ["work_plan_generate", workPlanUnit],
      ["work_plan_update", workPlanUnit],
      ["work_plan_contract", workPlanUnit],
      ["work_execute", workExecuteUnit],
      ["work_execute_contract", workExecuteUnit],
    ]);
  }
}
