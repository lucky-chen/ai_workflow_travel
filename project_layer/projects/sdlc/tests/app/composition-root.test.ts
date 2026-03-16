import assert from "node:assert/strict";

import { createApplicationRuntime } from "../../src/app/composition-root.js";

export async function runCompositionRootTests(): Promise<void> {
  await testCreateApplicationRuntimeBuildsProductionPipeline();
}

async function testCreateApplicationRuntimeBuildsProductionPipeline(): Promise<void> {
  const runtime = createApplicationRuntime();
  const architectureStage = runtime.registry.get("architecture_design");
  const moduleStage = runtime.registry.get("module_design");
  const implementationStage = runtime.registry.get("implementation_execution");
  const itemDesignStage = runtime.registry.get("item_design_generate");
  const workPlanStage = runtime.registry.get("work_plan_generate");
  const workExecuteContractStage = runtime.registry.get("work_execute_contract");

  runtime.registry.validate();
  assert.equal(typeof architectureStage.continuation?.continue, "function");
  assert.equal(moduleStage.nextStageId, "implementation_plan");
  assert.equal(implementationStage.nextStageId, null);
  assert.equal(itemDesignStage, moduleStage);
  assert.equal(workPlanStage.stageId, "implementation_plan");
  assert.equal(workExecuteContractStage.stageId, "validation");
  assert.equal(runtime.pipeline.constructor.name, "PipelineService");
}
