import assert from "node:assert/strict";

import { ContextAssembler } from "../src/context/context-assembler.js";
import { DefaultRetrievalProvider } from "../src/context/default-retrieval-provider.js";
import { RuntimeMemoryStore } from "../src/context/runtime-memory-store.js";
import { SessionHistoryStore } from "../src/context/session-history-store.js";

export async function runContextAssemblerTests(): Promise<void> {
  await testContextAssemblerBuildsAgentContext();
}

async function testContextAssemblerBuildsAgentContext(): Promise<void> {
  const historyStore = new SessionHistoryStore();
  const memoryStore = new RuntimeMemoryStore();
  const retrievalProvider = new DefaultRetrievalProvider();
  const assembler = new ContextAssembler(
    historyStore,
    memoryStore,
    retrievalProvider,
    "/tmp/agent-runtime",
  );

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
  assert.equal(context.runtimeContext.workdir, "/tmp/agent-runtime");
  assert.equal(context.runtimeContext.history.length, 1);
  assert.equal(context.runtimeContext.memory[0]?.key, "priority");
  assert.equal(context.runtimeContext.retrievalContext.length, 2);
}
