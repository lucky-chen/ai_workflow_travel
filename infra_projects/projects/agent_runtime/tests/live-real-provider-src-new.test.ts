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
    const existingTraceFiles = await listTraceFiles(item.workdir);
    const runtime = createRuntime({
      workdir: item.workdir,
      defaultModelMode: "real_from_local_env",
    });
    const session = await runtime.createSession({});
    const result = await session.execute({
      content: {
        task: `reply with provider name ${item.provider}`,
      },
    });
    assert.equal(result.errorCode, undefined, `${item.provider} returned error: ${result.errorMessage}`);
    assert.equal(Boolean(result.content), true, `${item.provider} returned empty content`);

    const readFileResult = await session.execute({
      content: {
        task: `read the first line of ${path.join(item.workdir, "README_FOR_MCP_TEST.txt")} and reply with that line only`,
      },
    });
    assert.equal(
      readFileResult.errorCode,
      undefined,
      `${item.provider} file-read returned error: ${readFileResult.errorMessage}`,
    );
    assert.equal(
      readFileResult.content,
      "hello-service fixture file",
      `${item.provider} file-read returned unexpected content`,
    );

    const trace = await loadNewTrace(item.workdir, existingTraceFiles);
    assert.equal(
      trace.events.some((event) => event.eventType === "model_called"),
      true,
      `${item.provider} trace missing model_called`,
    );
    assert.equal(
      trace.events.some((event) => event.eventType === "tool_called"),
      true,
      `${item.provider} trace missing tool_called`,
    );
  }
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
