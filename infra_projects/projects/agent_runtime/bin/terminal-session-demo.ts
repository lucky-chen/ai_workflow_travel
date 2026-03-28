#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as processInput, stdout as processOutput, stderr } from "node:process";

import type { RuntimeApi } from "../src_new/interface/api.js";
import { createRuntime } from "../src_new/runtime/runtime.js";
import { createTerminalSessionDemo } from "../src_new/application/terminal-session-demo.js";

export interface TerminalSessionCliOptions {
  argv?: string[];
  readInput?: () => Promise<string | null>;
  writeLine?: (line: string) => Promise<void> | void;
  writeError?: (line: string) => Promise<void> | void;
  createRuntime?: (input: { workdir: string }) => RuntimeApi;
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

  if (!parsed.workdir) {
    await writeError("Missing required --workdir.");
    return 1;
  }

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
    const runtime = (options.createRuntime ?? createRuntime)({
      workdir: parsed.workdir,
    });
    const demo = createTerminalSessionDemo({
      runtime,
      workdir: parsed.workdir,
      sessionId: parsed.sessionId,
      readInput: async () => {
        const rawText = await readInput();
        if (rawText === null) {
          return { rawText: "", closeRequested: true };
        }
        if (rawText.trim() === "/new") {
          return { rawText: "", closeRequested: true };
        }
        const reopen = rawText.match(/^\/open\s+(.+)$/);
        if (reopen) {
          return { rawText, closeRequested: true };
        }
        return {
          rawText,
          closeRequested: rawText.trim().toLowerCase() === "exit",
        };
      },
      writeLine,
    });

    await writeLine(`Runtime ready: ${parsed.workdir}`);
    await demo.run({
      runtime,
      workdir: parsed.workdir,
      sessionId: parsed.sessionId,
    });
    return 0;
  } catch (error: unknown) {
    await writeError(error instanceof Error ? error.message : String(error));
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
