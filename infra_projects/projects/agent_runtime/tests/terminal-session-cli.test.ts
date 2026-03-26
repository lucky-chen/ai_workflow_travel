import assert from "node:assert/strict";

import { runTerminalSessionCli } from "../bin/terminal-session-demo.js";

export async function runTerminalSessionCliTests(): Promise<void> {
  await testTerminalSessionCliRunsWithInjectedInput();
}

async function testTerminalSessionCliRunsWithInjectedInput(): Promise<void> {
  const outputLines: string[] = [];
  const errorLines: string[] = [];
  let calls = 0;

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", "/tmp/agent-runtime-cli"],
    readInput: async () => {
      calls += 1;
      return calls === 1 ? "exit" : null;
    },
    writeLine: async (line) => {
      outputLines.push(line);
    },
    writeError: async (line) => {
      errorLines.push(line);
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(errorLines.length, 0);
  assert.equal(outputLines.at(-1)?.startsWith("Session closed: "), true);
}
