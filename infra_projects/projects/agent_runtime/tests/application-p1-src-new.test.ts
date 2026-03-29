import assert from "node:assert/strict";

import { createTerminalSessionDemo } from "../src_new/application/terminal-session-demo.js";
import { createRuntime } from "../src_new/runtime/runtime.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runApplicationP1SrcNewTests(): Promise<void> {
  await testTerminalDemoCreateExecuteClose();
  await testTerminalDemoOpenExistingSession();
}

async function testTerminalDemoCreateExecuteClose(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-app-create-");
  const outputs: string[] = [];
  const runtime = createRuntime({ workdir });
  const demo = createTerminalSessionDemo({
    runtime,
    readInput: async () => {
      const next = outputs.length === 0 ? "hello demo" : "";
      return {
        rawText: next,
        closeRequested: outputs.length > 0,
      };
    },
    writeLine: async (line) => {
      outputs.push(line);
    },
  });

  const result = await demo.run({
    runtime,
  });

  assert.equal(typeof result.sessionId, "string");
  assert.equal(outputs.some((line) => line.includes("Session closed:")), true);
}

async function testTerminalDemoOpenExistingSession(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-app-open-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "existing assistant output",
        },
      },
    },
  });
  await session.execute({
    content: {
      task: "seed history",
    },
    mode: "chat",
  });
  const state = await session.load();
  const outputs: string[] = [];
  const demo = createTerminalSessionDemo({
    runtime,
    sessionId: state.sessionId,
    readInput: async () => ({
      rawText: "",
      closeRequested: true,
    }),
    writeLine: async (line) => {
      outputs.push(line);
    },
  });

  const result = await demo.run({
    runtime,
    sessionId: state.sessionId,
  });

  assert.equal(result.sessionId, state.sessionId);
  assert.equal(outputs.includes("[assistant] existing assistant output"), true);
  assert.equal(outputs.at(-1), `Session closed: ${state.sessionId}`);
}
