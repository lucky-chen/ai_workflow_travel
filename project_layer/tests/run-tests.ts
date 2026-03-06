import { runArtifactStoreTests } from "./artifact-store.test.js";
import { runImplementationGeneratorTests } from "./implementation-generator.test.js";
import { runLlmExecutorTests } from "./llm-executor.test.js";

async function main(): Promise<void> {
  await runArtifactStoreTests();
  await runImplementationGeneratorTests();
  await runLlmExecutorTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
