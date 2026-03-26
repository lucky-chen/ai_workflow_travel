import { runAgentRuntimeTests } from "./agent-runtime.test.js";
import { runAgentLoopTests } from "./agent-loop.test.js";
import { runContextAssemblerTests } from "./context-assembler.test.js";
import { runExecutionFlowTests } from "./execution-flow.test.js";
import { runExecutionStrategySelectorTests } from "./execution-strategy-selector.test.js";
import { runPlanningFlowTests } from "./planning-flow.test.js";
import { runResultNormalizerAndMetricsTests } from "./result-normalizer-and-metrics.test.js";
import { runRuntimeMemoryAndRetrievalTests } from "./runtime-memory-and-retrieval.test.js";
import { runSessionHistoryStoreTests } from "./session-history-store.test.js";
import { runTraceRecorderTests } from "./trace-recorder.test.js";

async function main(): Promise<void> {
  await runAgentRuntimeTests();
  await runAgentLoopTests();
  await runContextAssemblerTests();
  await runExecutionFlowTests();
  await runExecutionStrategySelectorTests();
  await runPlanningFlowTests();
  await runResultNormalizerAndMetricsTests();
  await runRuntimeMemoryAndRetrievalTests();
  await runSessionHistoryStoreTests();
  await runTraceRecorderTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
