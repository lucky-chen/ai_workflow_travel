import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
export async function runArtifactStoreTests() {
    await testWriteAndReadArtifact();
    await testListArtifactsWithinRoot();
    await testListArtifactsOnMissingRoot();
}
async function testWriteAndReadArtifact() {
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
        await assert.rejects(store.getArtifact({
            taskId: "task-1",
            stageId: "implementation",
            filePath: "docs/missing.md",
        }), (error) => {
            const nodeError = error;
            return nodeError.code === "ENOENT";
        });
    }
    finally {
        await rm(storageRoot, { recursive: true, force: true });
    }
}
async function testListArtifactsWithinRoot() {
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
    }
    finally {
        await rm(storageRoot, { recursive: true, force: true });
    }
}
async function testListArtifactsOnMissingRoot() {
    const storageRoot = await createTempDir("artifact-store-");
    try {
        const store = new ArtifactStoreService(storageRoot);
        const artifacts = await store.listArtifacts({
            taskId: "task-3",
            stageId: "requirement",
            rootDir: "missing",
        });
        assert.deepEqual(artifacts, []);
    }
    finally {
        await rm(storageRoot, { recursive: true, force: true });
    }
}
async function createTempDir(prefix) {
    const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
    await mkdir(tempRoot, { recursive: true });
    return mkdtemp(path.join(tempRoot, prefix));
}
