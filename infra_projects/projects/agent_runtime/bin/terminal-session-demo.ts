#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as processInput, stdout as processOutput, stderr } from "node:process";

import type { RuntimeApi } from "../src_new/interface/api.js";
import { createRuntime } from "../src_new/runtime/runtime.js";
import {
  createTerminalSessionDemo,
} from "../src_new/application/terminal-session-demo.js";

export interface TerminalSessionCliOptions {
  argv?: string[];
  readInput?: () => Promise<string | null>;
  writeLine?: (line: string) => Promise<void> | void;
  writeError?: (line: string) => Promise<void> | void;
  createRuntime?: (input: { workdir: string; defaultModelMode: "real_from_local_env" }) => RuntimeApi;
}

interface StoredSessionSummary {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export async function runTerminalSessionCli(
  options: TerminalSessionCliOptions = {},
): Promise<number> {
  const parsedArgs = parseArgs(options.argv ?? process.argv.slice(2));
  const writeLine = options.writeLine ?? (async (line: string) => {
    processOutput.write(`${line}\n`);
  });
  const writeError = options.writeError ?? (async (line: string) => {
    stderr.write(`${line}\n`);
  });

  if (!parsedArgs.workdir) {
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
      workdir: parsedArgs.workdir,
      defaultModelMode: "real_from_local_env",
    });
    const sessionId = await resolveStartupSessionId({
      parsedArgs,
      readInput,
      writeLine,
      writeError,
    });
    const demo = createTerminalSessionDemo({
      runtime,
      workdir: parsedArgs.workdir,
      sessionId,
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

    await writeLine(`Runtime ready: ${parsedArgs.workdir}`);
    await demo.run({
      runtime,
      workdir: parsedArgs.workdir,
      sessionId,
    });
    return 0;
  } catch (error: unknown) {
    await writeError(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    closeReadline?.();
  }
}

async function resolveStartupSessionId(input: {
  parsedArgs: { workdir?: string; sessionId?: string };
  readInput: () => Promise<string | null>;
  writeLine: (line: string) => Promise<void> | void;
  writeError: (line: string) => Promise<void> | void;
}): Promise<string | undefined> {
  const sessions = await listStoredSessions(input.parsedArgs.workdir!);

  if (input.parsedArgs.sessionId) {
    const requested = sessions.find((session) => session.sessionId === input.parsedArgs.sessionId);
    if (requested) {
      return requested.sessionId;
    }
    await input.writeError(
      `Session not found: ${input.parsedArgs.sessionId}. Choose a saved session or create a new one.`,
    );
  }

  if (sessions.length === 0) {
    await input.writeLine("No saved sessions found. Creating a new session.");
    return undefined;
  }

  await input.writeLine("Saved sessions:");
  for (const [index, session] of sessions.entries()) {
    await input.writeLine(`${index + 1}. ${session.sessionId} (${session.updatedAt})`);
  }
  await input.writeLine("Press Enter to create a new session, or enter a session number to continue.");

  const selectedIndex = await readSessionSelection(input.readInput, sessions.length);
  if (selectedIndex === undefined) {
    return undefined;
  }
  return sessions[selectedIndex].sessionId;
}

async function readSessionSelection(
  readInput: () => Promise<string | null>,
  sessionCount: number,
): Promise<number | undefined> {
  while (true) {
    const rawText = await readInput();
    const normalized = rawText?.trim() ?? "";
    if (normalized === "") {
      return undefined;
    }
    const selected = Number.parseInt(normalized, 10);
    if (Number.isInteger(selected) && selected >= 1 && selected <= sessionCount) {
      return selected - 1;
    }
  }
}

async function listStoredSessions(workdir: string): Promise<StoredSessionSummary[]> {
  const sessionsDir = path.join(workdir, ".agent_runtime", "sessions");
  try {
    const fileNames = await readdir(sessionsDir);
    const sessions = await Promise.all(
      fileNames
        .filter((fileName) => fileName.endsWith(".json"))
        .map(async (fileName) => readStoredSession(path.join(sessionsDir, fileName))),
    );
    return sessions
      .filter((session): session is StoredSessionSummary => session !== undefined)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return [];
    }
    throw error;
  }
}

async function readStoredSession(filePath: string): Promise<StoredSessionSummary | undefined> {
  const raw = await readFile(filePath, "utf8");
  const payload = JSON.parse(raw) as Record<string, unknown>;
  if (
    typeof payload.sessionId !== "string"
    || typeof payload.createdAt !== "string"
    || typeof payload.updatedAt !== "string"
  ) {
    return undefined;
  }
  return {
    sessionId: payload.sessionId,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function isMissingDirectoryError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
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
