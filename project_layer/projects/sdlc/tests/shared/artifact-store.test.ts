import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { HistoryStoreService } from "../../src/data/history-store/history-store.js";
import { TraceService } from "../../src/quality-gate/trace/trace-recorder.js";

export async function runArtifactStoreTests(): Promise<void> {
  await testWriteAndReadArtifact();
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
      stageId: "implementation",
      filePath: "docs/output.md",
      content: "generated artifact",
    });

    const expectedPath = path.join(storageRoot, "task-1", "implementation", "docs/output.md");
    const persistedContent = await readFile(expectedPath, "utf8");

    const content = await store.getArtifact({
      taskId: "task-1",
      stageId: "implementation",
      filePath: "docs/output.md",
    });

    assert.equal(persistedContent, "generated artifact");
    assert.equal(content, "generated artifact");

    await assert.rejects(
      store.getArtifact({
        taskId: "task-1",
        stageId: "implementation",
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
      stageId: "module-design",
      filePath: "docs/a.md",
      content: "A",
    });
    await store.writeArtifact({
      taskId: "task-2",
      stageId: "module-design",
      filePath: "docs/nested/b.md",
      content: "B",
    });
    await store.writeArtifact({
      taskId: "task-2",
      stageId: "module-design",
      filePath: "other/c.md",
      content: "C",
    });

    const artifacts = await store.listArtifacts({
      taskId: "task-2",
      stageId: "module-design",
      rootDir: "docs",
    });

    assert.deepEqual(artifacts, ["a.md", "nested/b.md"]);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

async function testWriteArtifactMirrorsWorkspaceWhenWorkspaceRootProvided(): Promise<void> {
  const storageRoot = await createTempDir("artifact-store-");
  const workspaceRoot = await createTempDir("artifact-workspace-");

  try {
    const store = new ArtifactStoreService(storageRoot);

    await store.writeArtifact({
      taskId: "task-workspace",
      stageId: "architecture_design",
      filePath: "sdlc/docs/architecture/TechnicalArchitecture.md",
      content: "workspace mirrored artifact",
      workspaceRoot,
    });

    assert.equal(
      await readFile(path.join(storageRoot, "task-workspace", "architecture_design", "sdlc/docs/architecture/TechnicalArchitecture.md"), "utf8"),
      "workspace mirrored artifact",
    );
    assert.equal(
      await readFile(path.join(workspaceRoot, "sdlc/docs/architecture/TechnicalArchitecture.md"), "utf8"),
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
      new TraceService(new HistoryStoreService(historyRoot)),
    );

    await store.writeArtifact({
      taskId: "task-history",
      stageId: "module_design",
      filePath: "sdlc/docs/module_design/Workflow.md",
      content: "history mirrored artifact",
    });

    const historyRecords = JSON.parse(
      await readFile(path.join(historyRoot, "records", "task-history.json"), "utf8"),
    ) as Array<{
      category: string;
      scope: { taskId: string; stageId: string };
      summary: string;
      payload: { filePath: string; mirroredToWorkspace: boolean };
    }>;

    assert.equal(historyRecords.length, 1);
    assert.equal(historyRecords[0]?.category, "artifact");
    assert.deepEqual(historyRecords[0]?.scope, {
      taskId: "task-history",
      stageId: "module_design",
    });
    assert.equal(historyRecords[0]?.payload.filePath, "sdlc/docs/module_design/Workflow.md");
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
      stageId: "requirement",
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
