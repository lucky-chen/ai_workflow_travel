import assert from "node:assert/strict";

import { DefaultRetrievalProvider } from "../src/context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../src/context/runtime-memory-store.js";

export async function runRuntimeMemoryAndRetrievalTests(): Promise<void> {
  await testRuntimeMemoryStoreLoadsSavedScope();
  await testDefaultRetrievalProviderReturnsBoundedItems();
}

async function testRuntimeMemoryStoreLoadsSavedScope(): Promise<void> {
  const store = new RuntimeMemoryStore();

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

  const items = await provider.load({
    query: "agent runtime design",
    candidateSources: ["design-doc", "api-doc"],
    metadata: {
      requestId: "req-1",
    },
  });

  assert.deepEqual(
    items.map((item) => item.ref),
    ["design-doc", "api-doc"],
  );
  assert.equal(items[0]?.metadata?.requestId, "req-1");
}
