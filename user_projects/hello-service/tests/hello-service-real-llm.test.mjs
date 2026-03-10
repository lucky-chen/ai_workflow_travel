import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertHelloServiceStageCallChain,
  loadTraceRecords,
  resetWorkspace,
  runCli,
  workspaceRoot,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-real-llm-task";
const runIds = {
  requirement: "3000-real-req",
  architecture: "3001-real-arch",
  module: "3002-real-module",
  implementationPlan: "3003-real-plan",
  implementationExecution: "3004-real-impl",
  mockRequirement: "3100-mock-req",
  mockArchitecture: "3101-mock-arch",
  mockModule: "3102-mock-module",
  mockImplementationPlan: "3103-mock-plan",
};

export async function runHelloServiceRealLlmRequirementTest() {
  await resetWorkspace();
  await runRequirementStage("real", true);

  const traceRecords = await loadTraceRecords(realLlmTaskId, runIds.requirement);
  assertHelloServiceStageCallChain(traceRecords, {
    workflowStageId: "requirement_interpretation",
    runtimeMode: "real",
    expectContractPassed: null,
  });
}

export async function runHelloServiceRealLlmArchitectureTest() {
  await resetWorkspace();
  await runRequirementStage("mock", true);
  await runArchitectureStage("real", true);

  const traceRecords = await loadTraceRecords(realLlmTaskId, runIds.architecture);
  assertHelloServiceStageCallChain(traceRecords, {
    workflowStageId: "architecture_design",
    runtimeMode: "real",
    expectContractPassed: null,
  });
}

export async function runHelloServiceRealLlmModuleTest() {
  await resetWorkspace();
  await runRequirementStage("mock", true);
  await runArchitectureStage("mock", true);
  await runModuleStage("real", true);

  const traceRecords = await loadTraceRecords(realLlmTaskId, runIds.module);
  assertHelloServiceStageCallChain(traceRecords, {
    workflowStageId: "module_design",
    runtimeMode: "real",
    expectContractPassed: null,
  });
}

export async function runHelloServiceRealLlmImplementationPlanTest() {
  await resetWorkspace();
  await runRequirementStage("mock", true);
  await runArchitectureStage("mock", true);
  await runModuleStage("mock", true);
  await runImplementationPlanStage("real", true);

  const traceRecords = await loadTraceRecords(realLlmTaskId, runIds.implementationPlan);
  assertHelloServiceStageCallChain(traceRecords, {
    workflowStageId: "implementation_plan",
    runtimeMode: "real",
    expectContractPassed: null,
  });
}

export async function runHelloServiceRealLlmImplementationExecutionTest() {
  await resetWorkspace();
  await runRequirementStage("mock", true);
  await runArchitectureStage("mock", true);
  await runModuleStage("mock", true);
  await runImplementationPlanStage("mock", true);
  await runImplementationExecutionStage("real", true);

  const traceRecords = await loadTraceRecords(realLlmTaskId, runIds.implementationExecution);
  assertHelloServiceStageCallChain(traceRecords, {
    workflowStageId: "implementation_execution",
    llmStageId: "implementation",
    runtimeMode: "real",
    expectContractPassed: null,
    expectAgentExecutionFinished: true,
  });
}

export async function runHelloServiceRealLlmTest() {
  await runHelloServiceRealLlmRequirementTest();
  await runHelloServiceRealLlmArchitectureTest();
  await runHelloServiceRealLlmModuleTest();
  await runHelloServiceRealLlmImplementationPlanTest();
  await runHelloServiceRealLlmImplementationExecutionTest();
}

async function runRequirementStage(runtimeMode, singleStep = false) {
  await runCli(buildGenerateArgs("requirement_interpretation", singleStep), {
    taskId: realLlmTaskId,
    runId: runtimeMode === "real" ? runIds.requirement : runIds.mockRequirement,
    runtimeMode,
  });
}

async function runArchitectureStage(runtimeMode, singleStep = false) {
  await runCli(buildGenerateArgs("architecture_design", singleStep), {
    taskId: realLlmTaskId,
    runId: runtimeMode === "real" ? runIds.architecture : runIds.mockArchitecture,
    runtimeMode,
  });
}

async function runModuleStage(runtimeMode, singleStep = false) {
  await runCli(buildGenerateArgs("module_design", singleStep), {
    taskId: realLlmTaskId,
    runId: runtimeMode === "real" ? runIds.module : runIds.mockModule,
    runtimeMode,
  });
}

async function runImplementationPlanStage(runtimeMode, singleStep = false) {
  await runCli(buildGenerateArgs("implementation_plan", singleStep), {
    taskId: realLlmTaskId,
    runId: runtimeMode === "real" ? runIds.implementationPlan : runIds.mockImplementationPlan,
    runtimeMode,
  });
}

async function runImplementationExecutionStage(runtimeMode, singleStep = false) {
  await runCli(buildGenerateArgs("implementation_execution", singleStep), {
    taskId: realLlmTaskId,
    runId: runIds.implementationExecution,
    runtimeMode,
  });
}

function buildGenerateArgs(stageId, singleStep) {
  const args = ["generate", "--stage", stageId, "--workspace", workspaceRoot];
  if (stageId === "module_design") {
    args.push("--target-module", "Workflow");
  }
  if (singleStep) {
    args.push("--single-step");
  }

  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
