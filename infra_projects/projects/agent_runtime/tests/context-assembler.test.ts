import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ContextAssembler } from "../src/context/context-assembler.js";
import { DefaultRetrievalProvider } from "../src/context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../src/context/runtime-memory-store.js";
import { SessionHistoryStore } from "../src/context/session-history-store.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runContextAssemblerTests(): Promise<void> {
  await testContextAssemblerBuildsAgentContext();
}

async function testContextAssemblerBuildsAgentContext(): Promise<void> {
  const workdir = await createTestWorkdir();
  const historyStore = new SessionHistoryStore(workdir);
  const memoryStore = new RuntimeMemoryStore(workdir);
  const retrievalProvider = new DefaultRetrievalProvider();
  const assembler = new ContextAssembler(
    historyStore,
    memoryStore,
    retrievalProvider,
    workdir,
  );
  await mkdir(path.join(workdir, "docs"), { recursive: true });
  await writeFile(path.join(workdir, "docs", "design.md"), "agent runtime design reference", "utf8");

  await historyStore.initialize("session-1", [
    {
      role: "user",
      content: "{\"task\":\"existing\"}",
    },
  ]);
  await memoryStore.save("scope-1", [
    {
      key: "priority",
      content: "p0",
    },
  ]);

  const context = await assembler.assemble(
    {
      sessionId: "session-1",
      createdAt: "2026-03-26T00:00:00.000Z",
      status: "active",
      transcript: [],
    },
    {
      payload: {
        prompt: {
          systemPrompt: ["system"],
          userPrompt: {
            task: "current",
          },
        },
        responseFormat: "json",
        memoryScope: "scope-1",
        retrievalQuery: "agent runtime design",
      },
      metadata: {
        requestId: "req-1",
      },
    },
  );

  assert.equal(context.runtimeContext.sessionId, "session-1");
  assert.equal(context.runtimeContext.workdir, workdir);
  assert.equal(context.runtimeContext.history.length, 1);
  assert.equal(context.runtimeContext.memory[0]?.key, "priority");
  assert.equal(context.runtimeContext.retrievalContext.length >= 1, true);
}
