import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

import { runTerminalSessionCli } from "../bin/terminal-session-demo.js";
import type { AgentRuntimeDependencies } from "../src/runtime/agent-runtime.js";
import { createTestWorkdir, writeTestLocalEnv } from "./test-workdir.js";

export async function runTerminalSessionCliTests(): Promise<void> {
  await testTerminalSessionCliRunsWithInjectedInput();
  await testTerminalSessionCliSupportsReopenWithinSameRuntime();
  await testTerminalSessionCliPrintsHintWhenSessionDoesNotExist();
  await testTerminalSessionCliPrintsChatJsonAnswerAsPlainText();
  await testTerminalSessionCliLoadsRealProviderConfigFromLocalEnv();
  await testTerminalSessionCliLoadsRealProviderConfigFromFixtureLocalEnv();
  await testTerminalSessionCliWritesTraceToAgentRuntimeStorage();
  await testTerminalSessionCliFailsWithoutWorkdir();
  await testTerminalSessionCliFailsWhenLocalEnvIsMissing();
  await testTerminalSessionCliFailsWhenLocalEnvIsInvalidJson();
  await testTerminalSessionCliFailsWhenLocalEnvConfigIsIncomplete();
}

async function testTerminalSessionCliRunsWithInjectedInput(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir);
  const outputLines: string[] = [];
  const errorLines: string[] = [];
  let calls = 0;

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
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
  assert.equal(outputLines[0]?.startsWith("Trace file: "), true);
  assert.equal(outputLines.at(-1)?.startsWith("Session closed: "), true);
}

async function testTerminalSessionCliSupportsReopenWithinSameRuntime(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir);
  const outputLines: string[] = [];
  const errorLines: string[] = [];
  const firstRuntimeSessionId = "session-reopen-target";
  let step = 0;

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => {
      step += 1;
      if (step === 1) {
        return "/new";
      }
      if (step === 2) {
        const readyLines = outputLines.filter((line) => line.startsWith("Session ready: "));
        const createdSessionId = readyLines.at(-1)?.replace("Session ready: ", "") ?? firstRuntimeSessionId;
        return `/open ${createdSessionId}`;
      }
      if (step === 3) {
        return "exit";
      }
      return null;
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
  assert.equal(outputLines[0]?.startsWith("Trace file: "), true);
  assert.equal(outputLines.filter((line) => line.startsWith("Session ready: ")).length >= 2, true);
}

async function testTerminalSessionCliPrintsHintWhenSessionDoesNotExist(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir);
  const outputLines: string[] = [];
  const errorLines: string[] = [];
  const missingSessionId = "missing-session";

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir, "--session-id", missingSessionId],
    readInput: async () => null,
    writeLine: async (line) => {
      outputLines.push(line);
    },
    writeError: async (line) => {
      errorLines.push(line);
    },
    createSessionApi: () => ({
      async createSession() {
        throw new Error("not used");
      },
      async openSession() {
        const error = new Error(
          `ENOENT: no such file or directory, open '${path.join(workdir, ".agent_runtime", "sessions", `${missingSessionId}.json`)}'`,
        ) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      async closeSession() {
        throw new Error("not used");
      },
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(outputLines[0], `Session API ready: ${workdir}`);
  assert.equal(
    errorLines[0],
    `Session not found: ${missingSessionId}. Start without --session-id to create a new session in ${workdir}.`,
  );
}

async function testTerminalSessionCliLoadsRealProviderConfigFromLocalEnv(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir, {
    provider: "deepseek",
    apiKey: "deepseek-key",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    timeoutMs: 10000,
  });
  let capturedDependencies: AgentRuntimeDependencies | undefined;

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => "exit",
    writeLine: async () => {},
    writeError: async () => {},
    createSessionApi: (dependencies) => {
      capturedDependencies = dependencies;
      return {
        async createSession() {
          return {
            async read() {
              return {
                sessionId: "session-cli",
                createdAt: new Date().toISOString(),
                status: "active",
                transcript: [],
              };
            },
            async execute() {
              throw new Error("not used");
            },
          };
        },
        async openSession() {
          throw new Error("not used");
        },
        async closeSession() {
          return {
            sessionId: "session-cli",
            closed: true,
            usageSummary: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          };
        },
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(capturedDependencies?.mode, "real");
  assert.equal(typeof capturedDependencies?.traceFileId, "string");
  assert.equal(capturedDependencies?.realProvider?.provider, "deepseek");
  assert.equal(capturedDependencies?.realProvider?.apiKey, "deepseek-key");
  assert.equal(capturedDependencies?.realProvider?.model, "deepseek-chat");
}

async function testTerminalSessionCliPrintsChatJsonAnswerAsPlainText(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir);
  const outputLines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => {
      const next = outputLines.includes("plain answer") ? "exit" : "hello";
      return next;
    },
    writeLine: async (line) => {
      outputLines.push(line);
    },
    writeError: async () => {},
    createSessionApi: () => ({
      async createSession() {
        return {
          async read() {
            return {
              sessionId: "session-cli-json",
              createdAt: new Date().toISOString(),
              status: "active",
              transcript: [],
            };
          },
          async execute() {
            return {
              status: "success" as const,
              payload: {
                content: "{\"answer\":\"plain answer\"}",
                responseFormat: "json" as const,
              },
            };
          },
        };
      },
      async openSession() {
        throw new Error("not used");
      },
      async closeSession() {
        return {
          sessionId: "session-cli-json",
          closed: true,
          usageSummary: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        };
      },
    }),
  });

  assert.equal(exitCode, 0);
  assert.equal(outputLines.includes("plain answer"), true);
  assert.equal(outputLines.includes("{\"answer\":\"plain answer\"}"), false);
}

async function testTerminalSessionCliLoadsRealProviderConfigFromFixtureLocalEnv(): Promise<void> {
  const fixtureWorkdir = path.resolve(
    process.cwd(),
    "tests/fixtures/hello-service-workdir",
  );
  let capturedDependencies: AgentRuntimeDependencies | undefined;

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", fixtureWorkdir],
    readInput: async () => "exit",
    writeLine: async () => {},
    writeError: async () => {},
    createSessionApi: (dependencies) => {
      capturedDependencies = dependencies;
      return {
        async createSession() {
          return {
            async read() {
              return {
                sessionId: "session-cli-fixture",
                createdAt: new Date().toISOString(),
                status: "active",
                transcript: [],
              };
            },
            async execute() {
              throw new Error("not used");
            },
          };
        },
        async openSession() {
          throw new Error("not used");
        },
        async closeSession() {
          return {
            sessionId: "session-cli-fixture",
            closed: true,
            usageSummary: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          };
        },
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(capturedDependencies?.mode, "real");
  assert.equal(typeof capturedDependencies?.traceFileId, "string");
  assert.equal(capturedDependencies?.realProvider?.provider, "deepseek");
  assert.equal(capturedDependencies?.realProvider?.apiKey, "sk-f05b66a5653249d18aba23e18d09fc2c");
  assert.equal(capturedDependencies?.realProvider?.baseUrl, "https://api.deepseek.com");
  assert.equal(capturedDependencies?.realProvider?.model, "deepseek-reasoner");
  assert.equal(capturedDependencies?.realProvider?.timeoutMs, 600000);
}

async function testTerminalSessionCliWritesTraceToAgentRuntimeStorage(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir);
  let capturedDependencies: AgentRuntimeDependencies | undefined;
  const traceDirPath = path.join(workdir, ".agent_runtime");

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => "exit",
    writeLine: async () => {},
    writeError: async () => {},
    createSessionApi: (dependencies) => {
      capturedDependencies = dependencies;
      return {
        async createSession() {
          await dependencies.traceRecorder?.record({
            scope: "sdk",
            eventType: "session_created",
            sessionId: "session-cli-trace",
            traceId: "trace-cli",
            timestamp: new Date().toISOString(),
            summary: "session created.",
          });
          return {
            async read() {
              return {
                sessionId: "session-cli-trace",
                createdAt: new Date().toISOString(),
                status: "active",
                transcript: [],
              };
            },
            async execute() {
              throw new Error("not used");
            },
          };
        },
        async openSession() {
          throw new Error("not used");
        },
        async closeSession() {
          return {
            sessionId: "session-cli-trace",
            closed: true,
            usageSummary: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          };
        },
      };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(Boolean(capturedDependencies?.traceRecorder), true);
  const traceFileNames = await readdir(traceDirPath);
  const traceFileName = traceFileNames.find((fileName) => /^agent-runtime-trace-.+\.json$/.test(fileName));
  assert.equal(Boolean(traceFileName), true);
  assert.equal(traceFileName, `agent-runtime-trace-${capturedDependencies?.traceFileId}.json`);
  const traceFile = await readFile(path.join(traceDirPath, traceFileName!), "utf8");
  const traceEvents = JSON.parse(traceFile) as Array<{ eventType?: string }>;
  assert.equal(Array.isArray(traceEvents), true);
  assert.equal(traceEvents.some((event) => event.eventType === "session_created"), true);
}

async function testTerminalSessionCliFailsWithoutWorkdir(): Promise<void> {
  const errorLines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: [],
    readInput: async () => null,
    writeLine: async () => {},
    writeError: async (line) => {
      errorLines.push(line);
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(errorLines[0], "Missing required --workdir.");
}

async function testTerminalSessionCliFailsWhenLocalEnvIsMissing(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  const errorLines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => null,
    writeLine: async () => {},
    writeError: async (line) => {
      errorLines.push(line);
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(errorLines[0]?.includes("Missing local env file:"), true);
}

async function testTerminalSessionCliFailsWhenLocalEnvIsInvalidJson(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  const localEnvPath = path.join(workdir, "sdlc", "local_env.json");
  await mkdir(path.dirname(localEnvPath), { recursive: true });
  await writeFile(localEnvPath, "{invalid-json", "utf8");
  const errorLines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => null,
    writeLine: async () => {},
    writeError: async (line) => {
      errorLines.push(line);
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(errorLines[0]?.includes("Invalid local env JSON:"), true);
}

async function testTerminalSessionCliFailsWhenLocalEnvConfigIsIncomplete(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-cli-");
  await writeTestLocalEnv(workdir, {
    apiKey: "your-api-key",
  });
  const errorLines: string[] = [];

  const exitCode = await runTerminalSessionCli({
    argv: ["--workdir", workdir],
    readInput: async () => null,
    writeLine: async () => {},
    writeError: async (line) => {
      errorLines.push(line);
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(
    errorLines[0]?.includes(`Error: Incomplete llm config in ${path.join(workdir, "sdlc", "local_env.json")}.`),
    true,
  );
}
