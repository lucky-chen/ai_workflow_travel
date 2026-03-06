import { runArtifactStoreTests } from "./artifact-store.test.js";
import { runChangeGateTests } from "./change-gate.test.js";
import { runCliTests } from "./cli.test.js";
import { runImplementationContractTests } from "./implementation-contract.test.js";
import { runImplementationGeneratorTests } from "./implementation-generator.test.js";
import { runImplementationStageRunnerTests } from "./implementation-stage-runner.test.js";
import { runLlmExecutorTests } from "./llm-executor.test.js";
import { runPipelineTests } from "./pipeline.test.js";
import { runTraceTests } from "./trace.test.js";

async function main(): Promise<void> {
  await runArtifactStoreTests();
  await runChangeGateTests();
  await runCliTests();
  await runImplementationContractTests();
  await runImplementationGeneratorTests();
  await runImplementationStageRunnerTests();
  await runLlmExecutorTests();
  await runPipelineTests();
  await runTraceTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
