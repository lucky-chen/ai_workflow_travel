import assert from "node:assert/strict";

import { LlmExecutorService } from "../../src/sdk/llm-executor/llm-executor.js";
import { loadLocalConfig } from "./load-local-config.js";

export async function runLlmExecutorIntegrationTests(): Promise<void> {
  const localConfig = await loadLocalConfig();
  await runProviderSmokeTest(localConfig);
  process.stdout.write("LLM integration tests passed.\n");
}

async function runProviderSmokeTest(localConfig: Awaited<ReturnType<typeof loadLocalConfig>>): Promise<void> {
  const provider =
    (process.env.LLM_PROVIDER as "openai" | "deepseek" | undefined) ?? localConfig.llm?.provider;
  const apiKey = process.env.LLM_API_KEY ?? localConfig.llm?.api_key;
  const baseUrl = process.env.LLM_BASE_URL ?? localConfig.llm?.base_url;
  const model = process.env.LLM_MODEL ?? localConfig.llm?.model;

  if (!provider || !apiKey || !model) {
    process.stdout.write("Skipping LLM integration: missing provider, api_key, or model.\n");
    return;
  }

  const executor = new LlmExecutorService({
    mode: "real",
    realProvider: {
      provider,
      apiKey,
      baseUrl,
      model,
    },
  });

  const result = await executor.execute({
    prompt: {
      systemPrompt: "Return a short plain-text answer.",
      userPrompt: "Reply with the word ok.",
    },
    responseFormat: "text",
    metadata: {
      provider,
    },
  });

  assert.equal(typeof result.content, "string");
  assert.equal(result.responseFormat, "text");
}

runLlmExecutorIntegrationTests().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
