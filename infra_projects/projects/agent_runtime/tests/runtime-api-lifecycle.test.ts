import assert from "node:assert/strict";

import { createAgentRuntime } from "../src/runtime/agent-runtime.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runRuntimeApiLifecycleTests(): Promise<void> {
  await testRuntimeApiLifecycleEndToEnd();
}

async function testRuntimeApiLifecycleEndToEnd(): Promise<void> {
  const workdir = await createTestWorkdir();
  const runtime = createAgentRuntime({
    workdir,
  });

  const created = await runtime.createSession({
    title: "runtime-api-lifecycle",
  });
  const createdState = await created.read();
  const reopened = await runtime.openSession({
    sessionId: createdState.sessionId,
  });
  const reopenedState = await reopened.read();

  assert.equal(reopenedState.sessionId, createdState.sessionId);
  assert.equal(await runtime.closeSession(createdState.sessionId), true);
  assert.equal(await runtime.closeSession(createdState.sessionId), false);

  const reopenedRuntime = createAgentRuntime({
    workdir,
  });
  const reopenedFromNewRuntime = await reopenedRuntime.openSession({
    sessionId: createdState.sessionId,
  });
  const reopenedFromNewRuntimeState = await reopenedFromNewRuntime.read();

  assert.equal(reopenedFromNewRuntimeState.sessionId, createdState.sessionId);
  assert.equal(reopenedFromNewRuntimeState.status, "active");
}
