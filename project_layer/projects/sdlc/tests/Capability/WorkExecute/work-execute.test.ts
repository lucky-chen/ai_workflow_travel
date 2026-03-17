import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { WorkExecuteContract } from "../../../src/Capability/WorkExecute/work-execute-contract.js";
import { WorkExecuteGenerator } from "../../../src/Capability/WorkExecute/work-execute-generator/work-execute-generator.js";
import { WorkExecuteRuntimeUnit } from "../../../src/Capability/WorkExecute/work-execute-runtime-unit.js";
import { ArtifactStoreService } from "../../../src/Data/artifact-store.js";
import type { ExecutionUnitResult, WorkExecuteArtifacts } from "../../../src/Runtime/Unit/execution-unit.js";
import { InMemoryTraceRecorder } from "../../../src/SDK/QualityControl/Trace/trace-recorder.js";
import { createExecutionContext, createMockLlmExecutor, createTempDir, removeTempDir } from "../test-helpers.js";

export async function runWorkExecuteCapabilityTests(): Promise<void> {
  await testWorkExecuteGeneratorReturnsChangedFiles();
  await testWorkExecuteContractUsesPreparedEnvironmentAndRunner();
  await testWorkExecuteRuntimeUnitPersistsGeneratedResult();
}

async function testWorkExecuteGeneratorReturnsChangedFiles(): Promise<void> {
  const workspaceRoot = await createTempDir("work-execute-generator-");

  try {
    await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "src", "index.ts"), "export const oldValue = true;\n", "utf8");

    const generator = new WorkExecuteGenerator({
      llmExecutor: createMockLlmExecutor(async () => ({
        content: JSON.stringify({
          summary: "Generated Workflow implementation.",
          changed_files: [
            {
              path: "src/index.ts",
              operation: "update",
              content: "export function hello(): string {\n  return \"hello-service\";\n}\n",
            },
          ],
        }),
        responseFormat: "json",
      })),
    });

    const result = await generator.run(
      createExecutionContext(workspaceRoot, "work_execute", {
        prepared_step_context: JSON.stringify(createPreparedStepContext()),
      }),
    );

    assert.equal(result.executionUnitId, "work_execute");
    assert.equal(result.success, true);
    assert.equal(result.summary, "Generated Workflow implementation.");
    assert.deepEqual(result.artifacts, {
      changedFiles: [
        {
          path: "src/index.ts",
          operation: "update",
          content: "export function hello(): string {\n  return \"hello-service\";\n}\n",
        },
      ],
      summary: "Generated Workflow implementation.",
    });
  } finally {
    await removeTempDir(workspaceRoot);
  }
}

async function testWorkExecuteContractUsesPreparedEnvironmentAndRunner(): Promise<void> {
  let receivedCommand = "";
  const contract = new WorkExecuteContract(
    {
      async prepare(_context, output: ExecutionUnitResult<WorkExecuteArtifacts>) {
        return {
          generatedResult: output.artifacts,
          testCommand: "npm test",
          command: "cd '/tmp/workspace' && npm test",
        };
      },
    },
    {
      async run(environment) {
        receivedCommand = environment.command;
        return {
          success: true,
          scriptName: "work_execute_contract",
          summary: "Test command passed: npm test",
          logs: "ok",
        };
      },
    },
    {
      build(testRunResult) {
        return {
          passed: testRunResult.success,
          summary: testRunResult.summary,
          issues: [],
        };
      },
    },
  );

  const result = await contract.check(
    createExecutionContext("/tmp/workspace", "work_execute_contract"),
    {
      executionUnitId: "work_execute",
      success: true,
      summary: "Generated Workflow implementation.",
      artifacts: {
        changedFiles: [
          {
            path: "src/index.ts",
            operation: "update",
            content: "export const value = true;\n",
          },
        ],
        summary: "Generated Workflow implementation.",
      },
    },
  );

  assert.equal(receivedCommand, "cd '/tmp/workspace' && npm test");
  assert.deepEqual(result, {
    passed: true,
    summary: "Test command passed: npm test",
    issues: [],
  });
}

async function testWorkExecuteRuntimeUnitPersistsGeneratedResult(): Promise<void> {
  const workspaceRoot = await createTempDir("work-execute-runtime-unit-");
  const storageRoot = await createTempDir("work-execute-artifacts-");

  try {
    await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "src", "index.ts"), "export const oldValue = true;\n", "utf8");
    const preparedStepContextPath = path.join(workspaceRoot, "tmp", "prepared-step-context.json");
    await mkdir(path.dirname(preparedStepContextPath), { recursive: true });
    await writeFile(
      preparedStepContextPath,
      JSON.stringify(createPreparedStepContext(), null, 2),
      "utf8",
    );

    const traceRecorder = new InMemoryTraceRecorder();
    const runtimeUnit = new WorkExecuteRuntimeUnit(
      new ArtifactStoreService(storageRoot, traceRecorder),
      traceRecorder,
      createMockLlmExecutor(async () => ({
        content: JSON.stringify({
          summary: "Generated Workflow implementation.",
          changed_files: [
            {
              path: "src/index.ts",
              operation: "update",
              content: "export function hello(): string {\n  return \"hello-service\";\n}\n",
            },
          ],
        }),
        responseFormat: "json",
      })),
    );

    const result = await runtimeUnit.run(
      {
        mode: "unit",
        executionUnitId: "work_execute",
        params: {
          preparedStepContextPath: path.relative(workspaceRoot, preparedStepContextPath),
        },
      },
      {
        workspaceRoot,
        runId: "work-execute-runtime-run",
      },
    );

    assert.equal(result.accepted, true);
    assert.match(result.summary, /Generated Workflow implementation/);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(workspaceRoot, "artifacts", "work", "work_execute_result.json"), "utf8")),
      {
        changedFiles: [
          {
            path: "src/index.ts",
            operation: "update",
            content: "export function hello(): string {\n  return \"hello-service\";\n}\n",
          },
        ],
        summary: "Generated Workflow implementation.",
      },
    );
  } finally {
    await removeTempDir(workspaceRoot);
    await removeTempDir(storageRoot);
  }
}

function createPreparedStepContext() {
  return {
    workplanRef: "sdlc/docs/work_plan.yaml#step-1.batch-1",
    workplan: {
      steps: [
        {
          stepId: "step-1",
          title: "Workflow baseline",
          status: "not_started",
          architectureModulesInScope: ["Workflow"],
          batches: [
            {
              batchId: "batch-1",
              title: "Create source file",
              status: "not_started",
              tasks: ["add src/index.ts with hello export"],
            },
          ],
        },
      ],
    },
    currentBatch: {
      batchId: "batch-1",
      title: "Create source file",
      status: "not_started",
      tasks: ["add src/index.ts with hello export"],
    },
    upstreamContext: {
      requirementDocument: "# Requirement\n",
      architectureDocument: "# Architecture\n",
      itemDesignDocuments: [
        {
          itemName: "Workflow",
          content: "# Workflow Design\n",
        },
      ],
    },
  };
}
