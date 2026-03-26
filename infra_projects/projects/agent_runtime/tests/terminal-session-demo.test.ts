import assert from "node:assert/strict";

import { createAgentRuntime } from "../src/runtime/agent-runtime.js";
import { runTerminalSessionDemo } from "../examples/terminal-session-demo.js";

export async function runTerminalSessionDemoTests(): Promise<void> {
  await testTerminalSessionDemoRunsInteractionFlow();
  await testTerminalSessionDemoClosesSessionOnExit();
  await testTerminalSessionDemoReopensExistingSessionBeforeClose();
}

async function testTerminalSessionDemoRunsInteractionFlow(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });
  const inputs = ["hello runtime", "exit"];
  const outputs: string[] = [];

  const result = await runTerminalSessionDemo({
    runtime,
    readInput: async () => inputs.shift() ?? null,
    writeOutput: async (line) => {
      outputs.push(line);
    },
  });

  assert.equal(outputs.length, 1);
  assert.equal(result.closed, true);
}

async function testTerminalSessionDemoClosesSessionOnExit(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });

  const result = await runTerminalSessionDemo({
    runtime,
    readInput: async () => null,
    writeOutput: async () => {},
  });

  assert.equal(result.closed, true);
  assert.equal(await runtime.closeSession(result.sessionId), false);
}

async function testTerminalSessionDemoReopensExistingSessionBeforeClose(): Promise<void> {
  const runtime = createAgentRuntime({
    workdir: "/tmp/agent-runtime",
  });
  const session = await runtime.createSession({
    title: "reopenable-terminal-session",
  });
  const state = await session.read();

  const result = await runTerminalSessionDemo({
    runtime,
    sessionId: state.sessionId,
    readInput: async () => "exit",
    writeOutput: async () => {},
  });

  assert.equal(result.sessionId, state.sessionId);
  assert.equal(result.closed, true);
}
