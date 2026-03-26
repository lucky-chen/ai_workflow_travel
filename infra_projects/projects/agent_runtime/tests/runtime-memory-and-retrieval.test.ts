import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

import { DefaultRetrievalProvider } from "../src/context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../src/context/runtime-memory-store.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runRuntimeMemoryAndRetrievalTests(): Promise<void> {
  await testRuntimeMemoryStoreLoadsSavedScope();
  await testDefaultRetrievalProviderReturnsBoundedItems();
}

async function testRuntimeMemoryStoreLoadsSavedScope(): Promise<void> {
  const store = new RuntimeMemoryStore(await createTestWorkdir());

  await store.save("scope-1", [
    {
      key: "priority",
      content: "p0",
    },
  ]);

  const memory = await store.load("scope-1");

  assert.deepEqual(memory, [
    {
      key: "priority",
      content: "p0",
    },
  ]);
}

async function testDefaultRetrievalProviderReturnsBoundedItems(): Promise<void> {
  const provider = new DefaultRetrievalProvider();
  const workdir = await createTestWorkdir();
  const docsDir = path.join(workdir, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(path.join(docsDir, "design.md"), "agent runtime design and execution plan", "utf8");
  await writeFile(path.join(docsDir, "api.md"), "session lifecycle and runtime api", "utf8");

  const items = await provider.load({
    query: "agent runtime design",
    candidateSources: [docsDir],
    metadata: {
      requestId: "req-1",
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.ref.endsWith("design.md"), true);
  assert.equal(items[0]?.content.includes("agent runtime design"), true);
  assert.equal(items[0]?.metadata?.requestId, "req-1");
}
