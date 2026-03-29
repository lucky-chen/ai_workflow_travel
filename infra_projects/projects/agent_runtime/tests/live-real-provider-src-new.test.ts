import assert from "node:assert/strict";
import path from "node:path";

import { createRuntime } from "../src_new/index.js";

interface LiveProviderCase {
  provider: "openai" | "deepseek";
  workdir: string;
}

export async function runLiveRealProviderSrcNewTests(cases: LiveProviderCase[]): Promise<void> {
  for (const item of cases) {
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
  }
}

async function main(): Promise<void> {
  const deepseekWorkdir = process.env.AGENT_RUNTIME_DEEPSEEK_WORKDIR
    ?? path.resolve(process.cwd(), "tests/fixtures/hello-service-workdir");
  const openaiWorkdir = process.env.AGENT_RUNTIME_OPENAI_WORKDIR;

  if (!openaiWorkdir) {
    throw new Error("Missing AGENT_RUNTIME_OPENAI_WORKDIR for openai live validation.");
  }

  await runLiveRealProviderSrcNewTests([
    { provider: "deepseek", workdir: deepseekWorkdir },
    { provider: "openai", workdir: openaiWorkdir },
  ]);
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
