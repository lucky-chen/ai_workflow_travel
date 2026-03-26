import { runAgentRuntimeTests } from "./agent-runtime.test.js";
import { runContextAssemblerTests } from "./context-assembler.test.js";
import { runExecutionStrategySelectorTests } from "./execution-strategy-selector.test.js";
import { runPlanningFlowTests } from "./planning-flow.test.js";
import { runRuntimeMemoryAndRetrievalTests } from "./runtime-memory-and-retrieval.test.js";
import { runSessionHistoryStoreTests } from "./session-history-store.test.js";

async function main(): Promise<void> {
  await runAgentRuntimeTests();
  await runContextAssemblerTests();
  await runExecutionStrategySelectorTests();
  await runPlanningFlowTests();
  await runRuntimeMemoryAndRetrievalTests();
  await runSessionHistoryStoreTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
