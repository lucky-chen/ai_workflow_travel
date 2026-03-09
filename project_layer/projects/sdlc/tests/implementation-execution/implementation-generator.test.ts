import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { ImplementationGenerator } from "../../src/execution/implementation-generator/implementation-generator.js";
import { ProjectContextLoader } from "../../src/execution/implementation-generator/project-context-loader.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import type { ProjectFile } from "../../src/shared/types/common.js";
import type { ImplementationWorkPlan } from "../../src/shared/contracts/implementation-workplan.js";

export async function runImplementationGeneratorTests(): Promise<void> {
  const storageRoot = await createTempDir("implementation-generator-");
  const workspaceRoot = await createTempDir("workspace-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  await artifactStore.writeArtifact({
    taskId: "task-1",
    stageId: "module-design",
    filePath: "module-design.md",
    content: "# module design",
  });

  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "existing.ts"), "export const value = 1;\n", "utf8");
  await writeFile(path.join(workspaceRoot, "obsolete.txt"), "to be deleted\n", "utf8");
  await mkdir(path.join(workspaceRoot, "dist"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "dist", "ignored.txt"), "ignored\n", "utf8");

  try {
    await testImplementationGeneratorProducesPlannedChanges(artifactStore, workspaceRoot);
    await testImplementationGeneratorRequiresPreparedStepContext(artifactStore, workspaceRoot);
    await testProjectContextLoaderIgnoresDistFiles(workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testImplementationGeneratorProducesPlannedChanges(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const llmExecutor = new MockLlmExecutor({
    summary: "Applied implementation updates.",
    changed_files: [
      {
        path: "src/generated.ts",
        operation: "create",
        content: "export const generated = true;\n",
      },
      {
        path: "src/existing.ts",
        operation: "update",
        content: "export const value = 2;\n",
      },
      {
        path: "obsolete.txt",
        operation: "delete",
      },
    ],
  });
  const generator = new ImplementationGenerator({
    artifactStore,
    llmExecutor,
  });

  const output = await generator.run({
    taskId: "task-1",
    stageId: "implementation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      prepared_step_context: JSON.stringify({
        workplanRef: "plans/implementation/ImplementationWorkPlan.md",
        workplan: createParsedWorkplan(),
        currentBatch: {
          batchId: "batch-1",
          title: "interfaces and skeleton",
          status: "completed",
          tasks: ["shared contracts"],
        },
        upstreamContext: {
          requirementDocument: "# requirement",
          architectureDocument: "# architecture",
          moduleDesignDocuments: [
            {
              moduleName: "module-design",
              content: "# module design",
            },
          ],
        },
      }),
    },
  });

  assert.equal(output.stageId, "implementation");
  assert.equal(output.success, true);
  assert.equal(output.summary, "Applied implementation updates.");
  assert.deepEqual(output.artifacts.changedFiles, [
    {
      path: "src/generated.ts",
      operation: "create",
      content: "export const generated = true;\n",
    },
    {
      path: "src/existing.ts",
      operation: "update",
      content: "export const value = 2;\n",
    },
    {
      path: "obsolete.txt",
      operation: "delete",
      content: undefined,
    },
  ]);

  await assert.rejects(access(path.join(workspaceRoot, "src", "generated.ts")));
  assert.equal(
    await readFile(path.join(workspaceRoot, "src", "existing.ts"), "utf8"),
    "export const value = 1;\n",
  );
  assert.equal(await readFile(path.join(workspaceRoot, "obsolete.txt"), "utf8"), "to be deleted\n");

  const requestPayload = JSON.parse(llmExecutor.getLastRequest()!.prompt.userPrompt) as {
    workplanRef: string;
    workplan: { steps: Array<{ stepId: string }> };
    currentBatch: { batchId: string };
    upstreamContext: {
      requirementDocument: string;
      architectureDocument: string;
      moduleDesignDocuments: Array<{ moduleName: string; content: string }>;
    };
  };
  assert.equal(requestPayload.workplanRef, "plans/implementation/ImplementationWorkPlan.md");
  assert.equal(requestPayload.workplan.steps[0]?.stepId, "step-1");
  assert.equal(requestPayload.currentBatch.batchId, "batch-1");
  assert.equal(requestPayload.upstreamContext.requirementDocument, "# requirement");
  assert.equal(requestPayload.upstreamContext.architectureDocument, "# architecture");
  assert.deepEqual(requestPayload.upstreamContext.moduleDesignDocuments, [
    {
      moduleName: "module-design",
      content: "# module design",
    },
  ]);
}

function createParsedWorkplan(): ImplementationWorkPlan {
  return {
    steps: [
      {
        stepId: "step-1",
        title: "Shared Workflow Backbone",
        status: "in_progress",
        architectureModulesInScope: ["Workflow/Pipeline"],
        batches: [
          {
            batchId: "batch-1",
            title: "interfaces and skeleton",
            status: "completed",
            tasks: ["shared contracts"],
          },
        ],
      },
    ],
  };
}

async function testImplementationGeneratorRequiresPreparedStepContext(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const generator = new ImplementationGenerator({
    artifactStore,
    llmExecutor: new MockLlmExecutor({
      summary: "unused",
      changed_files: [],
    }),
  });

  await assert.rejects(
    generator.run({
      taskId: "task-2",
      stageId: "implementation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    }),
    /Missing required input artifact "prepared_step_context"\./,
  );
}

async function testProjectContextLoaderIgnoresDistFiles(workspaceRoot: string): Promise<void> {
  const projectContextLoader = new ProjectContextLoader();
  const projectContext = await projectContextLoader.loadProjectContext({
    taskId: "task-1",
    stageId: "implementation",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
  });
  assert.equal(projectContext.relevantFiles.some((file: ProjectFile) => file.path === "dist/ignored.txt"), false);
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class MockLlmExecutor implements ILlmExecutor {
  private lastRequest?: LlmExecutionRequest;

  constructor(private readonly result: Record<string, unknown>) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    this.lastRequest = request;
    return {
      content: JSON.stringify(this.result),
      responseFormat: "json",
    };
  }

  getLastRequest(): LlmExecutionRequest | undefined {
    return this.lastRequest;
  }
}
