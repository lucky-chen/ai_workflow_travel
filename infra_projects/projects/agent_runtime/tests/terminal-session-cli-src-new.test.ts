import assert from "node:assert/strict";

import { runTerminalSessionCli } from "../bin/terminal-session-demo.js";
import { createSessionApi } from "../src/runtime/session-controller.js";
import { createTestWorkdir, writeTestLocalEnv } from "./test-workdir.js";

export async function runTerminalSessionCliSrcNewTests(): Promise<void> {
  await testTerminalCliAllowsSelectingExistingSessionFromSavedList();
  await testTerminalCliFallsBackToSelectionWhenRequestedSessionIsMissing();
}

async function testTerminalCliAllowsSelectingExistingSessionFromSavedList(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-src-new-list-");
  await writeTestLocalEnv(workdir);
  const seedRuntime = createSessionApi({ workdir });
  const session = await seedRuntime.createSession({
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

  const outputs: string[] = [];
  const errors: string[] = [];
  let step = 0;
  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: () => {
      step += 1;
      if (step === 1) {
        return Promise.resolve("1");
      }
      return Promise.resolve("exit");
    },
    writeLine: (line) => {
      outputs.push(line);
    },
    writeError: (line) => {
      errors.push(line);
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(errors.length, 0);
  assert.equal(outputs.includes("Saved sessions:"), true);
  assert.equal(outputs.includes("[assistant] existing assistant output"), true);
}

async function testTerminalCliFallsBackToSelectionWhenRequestedSessionIsMissing(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-src-new-missing-");
  await writeTestLocalEnv(workdir);
  const seedRuntime = createSessionApi({ workdir });
  const session = await seedRuntime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "fallback assistant output",
        },
      },
    },
  });
  await session.execute({
    content: {
      task: "what is seed history",
    },
  });

  const outputs: string[] = [];
  const errors: string[] = [];
  let step = 0;
  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir, "--session-id", "missing-session"],
    readInput: () => {
      step += 1;
      if (step === 1) {
        return Promise.resolve("1");
      }
      return Promise.resolve("exit");
    },
    writeLine: (line) => {
      outputs.push(line);
    },
    writeError: (line) => {
      errors.push(line);
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(
    errors[0],
    "Session not found: missing-session. Choose a saved session or create a new one.",
  );
  assert.equal(outputs.includes("Saved sessions:"), true);
  assert.equal(outputs.includes("[assistant] fallback assistant output"), true);
  assert.equal(outputs.at(-1), `Session closed: ${session.sessionId}`);
}
