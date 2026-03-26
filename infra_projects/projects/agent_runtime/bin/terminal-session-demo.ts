#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as processInput, stdout as processOutput, stderr } from "node:process";

import {
  createAgentRuntime,
  type AgentRuntimeDependencies,
  type AgentRuntime,
  type AgentRuntimeResult,
  type AgentSession,
} from "../src/runtime/agent-runtime.js";
import { FileAgentTraceRecorder } from "../src/runtime/file-agent-trace-recorder.js";
import { createRuntimeTraceFileId, resolveRuntimeTracePath } from "../src/runtime/runtime-storage-paths.js";
import { loadRequiredRealProviderConfig } from "../src/runtime/workspace-local-env.js";

export interface TerminalSessionCliOptions {
  argv?: string[];
  readInput?: () => Promise<string | null>;
  writeLine?: (line: string) => Promise<void> | void;
  writeError?: (line: string) => Promise<void> | void;
  createRuntime?: (dependencies: AgentRuntimeDependencies) => AgentRuntime;
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
  let flushTrace: (() => Promise<void>) | undefined;
  const readInput = options.readInput ?? (() => {
    const rl = createInterface({
      input: processInput,
      output: processOutput,
    });
    closeReadline = () => rl.close();
    return async () => rl.question("> ");
  })();

  try {
    const traceFileId = createRuntimeTraceFileId();
    const tracePath = resolveRuntimeTracePath(parsed.workdir, traceFileId);
    const traceRecorder = new FileAgentTraceRecorder(tracePath);
    const runtime = (options.createRuntime ?? createAgentRuntime)({
      workdir: parsed.workdir,
      traceFileId,
      mode: "real",
      realProvider: await loadRequiredRealProviderConfig(parsed.workdir),
      traceRecorder,
    });
    flushTrace = async () => traceRecorder.flush();
    let session = await openInitialSession(runtime, parsed.sessionId);
    await writeLine(`Trace file: ${tracePath}`);
    await writeLine(`Session ready: ${(await session.read()).sessionId}`);

    while (true) {
      const input = await readInput();
      if (input === null || input.trim().toLowerCase() === "exit") {
        const sessionState = await session.read();
        const closeResult = await runtime.closeSession(sessionState.sessionId);
        await writeLine(
          `Session closed: ${sessionState.sessionId} (${closeResult.closed ? "closed" : "already-closed"}) `
          + `[tokens in=${closeResult.usageSummary.inputTokens} out=${closeResult.usageSummary.outputTokens} total=${closeResult.usageSummary.totalTokens}]`,
        );
        break;
      }

      const reopenMatch = input.match(/^\/open\s+(.+)$/);
      if (reopenMatch) {
        session = await runtime.openSession({
          sessionId: reopenMatch[1].trim(),
        });
        await writeLine(`Session ready: ${(await session.read()).sessionId}`);
        continue;
      }

      if (input.trim() === "/new") {
        session = await runtime.createSession({});
        await writeLine(`Session ready: ${(await session.read()).sessionId}`);
        continue;
      }

      const result = await session.execute({
        payload: {
          prompt: {
            systemPrompt: ["You are an agent runtime assistant."],
            userPrompt: {
              input,
            },
          },
          responseFormat: "json",
        },
      });
      await writeLine(formatCliResult(result));
    }

    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await writeError(message);
    return 1;
  } finally {
    await flushTrace?.();
    closeReadline?.();
  }
}

function formatCliResult(result: AgentRuntimeResult): string {
  const content = result.payload.content?.trim();
  if (result.payload.responseFormat === "json" && content) {
    try {
      const parsed = JSON.parse(content) as { answer?: unknown };
      if (typeof parsed.answer === "string") {
        return parsed.answer;
      }
    } catch {}
  }

  return result.payload.content ?? result.payload.summary ?? "";
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

async function openInitialSession(runtime: AgentRuntime, sessionId?: string): Promise<AgentSession> {
  if (sessionId) {
    return runtime.openSession({ sessionId });
  }

  return runtime.createSession({});
}

const isDirectRun = process.argv[1]?.endsWith("/terminal-session-demo.js")
  || process.argv[1]?.endsWith("\\terminal-session-demo.js");

if (isDirectRun) {
  const exitCode = await runTerminalSessionCli();
  process.exitCode = exitCode;
}
