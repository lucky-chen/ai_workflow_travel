import assert from "node:assert/strict";

import {
  createTerminalSessionDemo,
  toSessionEventDisplay,
} from "../src/application/terminal-session-demo.js";
import { createSessionApi } from "../src/interface/api.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runApplicationP1SrcNewTests(): Promise<void> {
  await testTerminalDemoCreateExecuteClose();
  await testTerminalDemoOpenExistingSession();
  await testSessionEventDisplayMapping();
}

async function testTerminalDemoCreateExecuteClose(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-app-create-");
  const outputs: string[] = [];
  const runtime = createSessionApi({ workdir });
  const demo = createTerminalSessionDemo({
    runtime,
    readInput: () => {
      const next = outputs.length === 0 ? "hello demo" : "";
      return Promise.resolve({
        rawText: next,
        closeRequested: outputs.length > 0,
      });
    },
    writeLine: (line) => {
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
  const runtime = createSessionApi({ workdir });
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
      task: "what is seed history",
    },
  });
  const state = await session.load();
  const outputs: string[] = [];
  const demo = createTerminalSessionDemo({
    runtime,
    sessionId: state.sessionId,
    readInput: () => Promise.resolve({
      rawText: "",
      closeRequested: true,
    }),
    writeLine: (line) => {
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

function testSessionEventDisplayMapping(): Promise<void> {
  const createdDisplay = toSessionEventDisplay({
    brief: "session_created",
    timestamp: new Date().toISOString(),
  });
  const finishedDisplay = toSessionEventDisplay({
    brief: "run_finished",
    timestamp: new Date().toISOString(),
  });
  const unknownDisplay = toSessionEventDisplay({
    brief: "context_assembled",
    timestamp: new Date().toISOString(),
  });

  assert.equal(createdDisplay.title, "Session created");
  assert.equal(finishedDisplay.title, "Run finished");
  assert.equal(unknownDisplay.title, "context_assembled");
  return Promise.resolve();
}
