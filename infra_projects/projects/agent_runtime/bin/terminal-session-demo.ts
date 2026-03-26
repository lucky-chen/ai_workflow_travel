#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin as processInput, stdout as processOutput, stderr } from "node:process";

import { runTerminalSessionDemo } from "../examples/terminal-session-demo.js";

export interface TerminalSessionCliOptions {
  argv?: string[];
  readInput?: () => Promise<string | null>;
  writeLine?: (line: string) => Promise<void> | void;
  writeError?: (line: string) => Promise<void> | void;
}

export async function runTerminalSessionCli(
  options: TerminalSessionCliOptions = {},
): Promise<number> {
  const parsed = parseArgs(options.argv ?? process.argv.slice(2));
  const writeLine = options.writeLine ?? (async (line: string) => {
    processOutput.write(`${line}\n`);
  });
  const writeError = options.writeError ?? (async (line: string) => {
    stderr.write(`${line}\n`);
  });

  let closeReadline: (() => void) | undefined;
  const readInput = options.readInput ?? (() => {
    const rl = createInterface({
      input: processInput,
      output: processOutput,
    });
    closeReadline = () => rl.close();
    return async () => rl.question("> ");
  })();

  try {
    const result = await runTerminalSessionDemo({
      workdir: parsed.workdir ?? process.cwd(),
      ...(parsed.sessionId ? { sessionId: parsed.sessionId } : {}),
      readInput,
      writeOutput: writeLine,
    });
    await writeLine(`Session closed: ${result.sessionId}`);
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await writeError(message);
    return 1;
  } finally {
    closeReadline?.();
  }
}

function parseArgs(argv: string[]): { workdir?: string; sessionId?: string } {
  const parsed: { workdir?: string; sessionId?: string } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--workdir" && next) {
      parsed.workdir = next;
      index += 1;
      continue;
    }

    if (current === "--session-id" && next) {
      parsed.sessionId = next;
      index += 1;
    }
  }

  return parsed;
}

const isDirectRun = process.argv[1]?.endsWith("/terminal-session-demo.js")
  || process.argv[1]?.endsWith("\\terminal-session-demo.js");

if (isDirectRun) {
  const exitCode = await runTerminalSessionCli();
  process.exitCode = exitCode;
}
