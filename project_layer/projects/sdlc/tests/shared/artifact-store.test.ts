import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/Data/artifact-store.js";
import { HistoryStoreService } from "../../src/Data/history-store.js";
import { TraceService } from "../../src/SDK/QualityControl/Trace/trace-recorder.js";

export async function runArtifactStoreTests(): Promise<void> {
  await testWriteAndReadArtifact();
  await testDefaultStorageRootUsesWorkspaceDistDirectory();
  await testWriteArtifactMirrorsWorkspaceWhenWorkspaceRootProvided();
  await testWriteArtifactPersistsHistoryRecord();
  await testListArtifactsWithinRoot();
  await testListArtifactsOnMissingRoot();
}

async function testWriteAndReadArtifact(): Promise<void> {
  const storageRoot = await createTempDir("artifact-store-");

  try {
    const store = new ArtifactStoreService(storageRoot);

    await store.writeArtifact({
      taskId: "task-1",
      executionUnitId: "implementation",
      filePath: "docs/output.md",
      content: "generated artifact",
    });

    const expectedPath = path.join(storageRoot, "task-1", "implementation", "docs/output.md");
    const persistedContent = await readFile(expectedPath, "utf8");

    const content = await store.getArtifact({
      taskId: "task-1",
      executionUnitId: "implementation",
      filePath: "docs/output.md",
    });

    assert.equal(persistedContent, "generated artifact");
    assert.equal(content, "generated artifact");

    await assert.rejects(
      store.getArtifact({
        taskId: "task-1",
        executionUnitId: "implementation",
        filePath: "docs/missing.md",
      }),
      (error: unknown) => {
        const nodeError = error as NodeJS.ErrnoException;
        return nodeError.code === "ENOENT";
      },
    );
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function testListArtifactsWithinRoot(): Promise<void> {
  const storageRoot = await createTempDir("artifact-store-");

  try {
    const store = new ArtifactStoreService(storageRoot);
    await store.writeArtifact({
      taskId: "task-2",
      executionUnitId: "item_design",
      filePath: "docs/a.md",
      content: "A",
    });
    await store.writeArtifact({
      taskId: "task-2",
      executionUnitId: "item_design",
      filePath: "docs/nested/b.md",
      content: "B",
    });
    await store.writeArtifact({
      taskId: "task-2",
      executionUnitId: "item_design",
      filePath: "other/c.md",
      content: "C",
    });

    const artifacts = await store.listArtifacts({
      taskId: "task-2",
      executionUnitId: "item_design",
      rootDir: "docs",
    });

    assert.deepEqual(artifacts, ["a.md", "nested/b.md"]);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function testDefaultStorageRootUsesWorkspaceDistDirectory(): Promise<void> {
  const workspaceRoot = await createTempDir("artifact-default-workspace-");

  try {
    const store = new ArtifactStoreService();

    await store.writeArtifact({
      taskId: "task-default",
      executionUnitId: "work_execute_contract",
      filePath: "artifacts/work/work_execute_contract_result.json",
      content: "default workspace artifact",
      workspaceRoot,
    });

    const persistedPath = path.join(
      workspaceRoot,
      "dist",
      "sdlc",
      "artifact_store",
      "task-default",
      "work_execute_contract",
      "artifacts/work/work_execute_contract_result.json",
    );

    assert.equal(await readFile(persistedPath, "utf8"), "default workspace artifact");
    assert.equal(
      await store.getArtifact({
        taskId: "task-default",
        executionUnitId: "work_execute_contract",
        filePath: "artifacts/work/work_execute_contract_result.json",
        workspaceRoot,
      }),
      "default workspace artifact",
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testWriteArtifactMirrorsWorkspaceWhenWorkspaceRootProvided(): Promise<void> {
  const storageRoot = await createTempDir("artifact-store-");
  const workspaceRoot = await createTempDir("artifact-workspace-");

  try {
    const store = new ArtifactStoreService(storageRoot);

    await store.writeArtifact({
      taskId: "task-workspace",
      executionUnitId: "architecture_design",
      filePath: "sdlc/docs/TechnicalArchitecture.md",
      content: "workspace mirrored artifact",
      workspaceRoot,
    });

    assert.equal(
      await readFile(path.join(storageRoot, "task-workspace", "architecture_design", "sdlc/docs/TechnicalArchitecture.md"), "utf8"),
      "workspace mirrored artifact",
    );
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md"), "utf8"),
      "workspace mirrored artifact",
    );
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testWriteArtifactPersistsHistoryRecord(): Promise<void> {
  const storageRoot = await createTempDir("artifact-store-");
  const historyRoot = await createTempDir("artifact-history-");

  try {
    const store = new ArtifactStoreService(
      storageRoot,
      new TraceService(new HistoryStoreService(historyRoot), {
        taskId: "task-history",
        runId: "run-history",
      }),
    );

    await store.writeArtifact({
      taskId: "task-history",
      executionUnitId: "item_design",
      filePath: "sdlc/docs/item_design/Workflow.md",
      content: "history mirrored artifact",
    });

    const historyRecords = JSON.parse(
      await readFile(path.join(historyRoot, "records", "task-history_run-history.json"), "utf8"),
    ) as Array<{
      category: string;
      scope: { taskId: string; runId: string; executionUnitId: string };
      summary: string;
      payload: { filePath: string; mirroredToWorkspace: boolean };
    }>;

    assert.equal(historyRecords.length, 1);
    assert.equal(historyRecords[0]?.category, "artifact");
    assert.deepEqual(historyRecords[0]?.scope, {
      taskId: "task-history",
      runId: "run-history",
      executionUnitId: "item_design",
    });
    assert.equal(historyRecords[0]?.payload.filePath, "sdlc/docs/item_design/Workflow.md");
    assert.equal(historyRecords[0]?.payload.mirroredToWorkspace, false);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(historyRoot, { recursive: true, force: true });
  }
}

async function testListArtifactsOnMissingRoot(): Promise<void> {
  const storageRoot = await createTempDir("artifact-store-");

  try {
    const store = new ArtifactStoreService(storageRoot);

    const artifacts = await store.listArtifacts({
      taskId: "task-3",
      executionUnitId: "requirement",
      rootDir: "missing",
    });

    assert.deepEqual(artifacts, []);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}
