import { runAgentRuntimeTests } from "./agent-runtime.test.js";
import { runAgentLoopTests } from "./agent-loop.test.js";
import { runContextAssemblerTests } from "./context-assembler.test.js";
import { runExecutionFlowTests } from "./execution-flow.test.js";
import { runExecutionStrategySelectorTests } from "./execution-strategy-selector.test.js";
import { runPlanningFlowTests } from "./planning-flow.test.js";
import { runObservabilityBoundaryTests } from "./observability-boundaries.test.js";
import { runResultNormalizerAndMetricsTests } from "./result-normalizer-and-metrics.test.js";
import { runRuntimeApiLifecycleTests } from "./runtime-api-lifecycle.test.js";
import { runRuntimeMemoryAndRetrievalTests } from "./runtime-memory-and-retrieval.test.js";
import { runSessionHistoryStoreTests } from "./session-history-store.test.js";
import { runTraceRecorderTests } from "./trace-recorder.test.js";
import { runTerminalSessionDemoTests } from "./terminal-session-demo.test.js";

async function main(): Promise<void> {
  await runAgentRuntimeTests();
  await runAgentLoopTests();
  await runContextAssemblerTests();
  await runExecutionFlowTests();
  await runExecutionStrategySelectorTests();
  await runObservabilityBoundaryTests();
  await runPlanningFlowTests();
  await runResultNormalizerAndMetricsTests();
  await runRuntimeApiLifecycleTests();
  await runRuntimeMemoryAndRetrievalTests();
  await runSessionHistoryStoreTests();
  await runTerminalSessionDemoTests();
  await runTraceRecorderTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
