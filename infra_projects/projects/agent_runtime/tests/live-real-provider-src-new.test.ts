import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createRuntime } from "../src_new/index.js";

interface LiveProviderCase {
  provider: "openai" | "deepseek";
  workdir: string;
}

export async function runLiveRealProviderSrcNewTests(cases: LiveProviderCase[]): Promise<void> {
  for (const item of cases) {
    await runLiveModeCase({
      provider: item.provider,
      workdir: item.workdir,
      task: `/chat reply with provider name ${item.provider} only`,
      expectedContent: item.provider,
      requireToolCall: false,
      label: "chat",
    });
    await runLiveModeCase({
      provider: item.provider,
      workdir: item.workdir,
      task: `/react read the first line of ${path.join(item.workdir, "README_FOR_MCP_TEST.txt")} and reply with exactly hello-service fixture file only`,
      expectedContent: "hello-service fixture file",
      requireToolCall: true,
      label: "react",
    });
    await runLiveModeCase({
      provider: item.provider,
      workdir: item.workdir,
      task: `/plan first read the first line of ${path.join(item.workdir, "README_FOR_MCP_TEST.txt")} then reply with exactly PEO_OK:hello-service fixture file only`,
      expectedContent: "PEO_OK:hello-service fixture file",
      requireToolCall: true,
      label: "peo",
    });
  }
}

async function runLiveModeCase(input: {
  provider: LiveProviderCase["provider"];
  workdir: string;
  task: string;
  expectedContent: string;
  requireToolCall: boolean;
  label: "chat" | "react" | "peo";
}): Promise<void> {
  const existingTraceFiles = await listTraceFiles(input.workdir);
  const runtime = createRuntime({
    workdir: input.workdir,
    defaultModelMode: "real_from_local_env",
  });
  const session = await runtime.createSession({});
  const result = await session.execute({
    content: {
      task: input.task,
    },
  });
  assert.equal(
    result.errorCode,
    undefined,
    `${input.provider} ${input.label} returned error: ${result.errorMessage}`,
  );
  const content = String(result.content ?? "").trim();
  if (input.label === "react" || input.label === "peo") {
    assert.equal(
      content.includes(input.expectedContent),
      true,
      `${input.provider} ${input.label} returned unexpected content`,
    );
  } else {
    assert.equal(
      content,
      input.expectedContent,
      `${input.provider} ${input.label} returned unexpected content`,
    );
  }

  const trace = await loadNewTrace(input.workdir, existingTraceFiles);
  assert.equal(
    trace.events.some((event) => event.eventType === "model_called"),
    true,
    `${input.provider} ${input.label} trace missing model_called`,
  );
  assert.equal(
    trace.events.some((event) => event.eventType === "tool_called"),
    input.requireToolCall,
    `${input.provider} ${input.label} trace tool_called mismatch`,
  );
}

async function listTraceFiles(workdir: string): Promise<string[]> {
  const tracesDir = path.join(workdir, ".agent_runtime", "traces");
  try {
    return (await readdir(tracesDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

async function loadNewTrace(
  workdir: string,
  existingTraceFiles: string[],
): Promise<{ events: Array<{ eventType?: string }> }> {
  const tracesDir = path.join(workdir, ".agent_runtime", "traces");
  const currentTraceFiles = await listTraceFiles(workdir);
  const newTraceFile = currentTraceFiles.find((fileName) => !existingTraceFiles.includes(fileName));
  if (!newTraceFile) {
    throw new Error(`No new trace file found in ${tracesDir}.`);
  }
  return JSON.parse(await readFile(path.join(tracesDir, newTraceFile), "utf8")) as {
    events: Array<{ eventType?: string }>;
  };
}

async function main(): Promise<void> {
  const deepseekWorkdir = process.env.AGENT_RUNTIME_DEEPSEEK_WORKDIR
    ?? path.resolve(process.cwd(), "tests/fixtures/hello-service-workdir");
  const openaiWorkdir = process.env.AGENT_RUNTIME_OPENAI_WORKDIR;
  const requestedProviders = process.env.AGENT_RUNTIME_LIVE_PROVIDERS;
  const selectedProviders = requestedProviders
    ? requestedProviders.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;
  const cases: LiveProviderCase[] = [];

  if (!selectedProviders || selectedProviders.includes("deepseek")) {
    cases.push({ provider: "deepseek", workdir: deepseekWorkdir });
  }

  if ((!selectedProviders || selectedProviders.includes("openai")) && openaiWorkdir) {
    cases.push({ provider: "openai", workdir: openaiWorkdir });
  }

  if (cases.length === 0) {
    throw new Error("No live LLM providers configured. Set AGENT_RUNTIME_DEEPSEEK_WORKDIR, AGENT_RUNTIME_OPENAI_WORKDIR, or AGENT_RUNTIME_LIVE_PROVIDERS.");
  }

  await runLiveRealProviderSrcNewTests(cases);
  process.stdout.write("Live real-provider tests passed.\n");
}

const isDirectRun = process.argv[1]?.endsWith("/live-real-provider-src-new.test.js")
  || process.argv[1]?.endsWith("\\live-real-provider-src-new.test.js");

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
