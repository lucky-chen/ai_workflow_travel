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
import { runSessionTranscriptStoreTests } from "./session-transcript-store.test.js";
import { runTerminalSessionCliTests } from "./terminal-session-cli.test.js";
import { runTraceRecorderTests } from "./trace-recorder.test.js";
import { runTerminalSessionDemoTests } from "./terminal-session-demo.test.js";
import { runRuntimeFoundationSrcNewTests } from "./runtime-foundation-src-new.test.js";
import { runContextFoundationSrcNewTests } from "./context-foundation-src-new.test.js";
import { runModelFoundationSrcNewTests } from "./model-foundation-src-new.test.js";

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
  await runSessionTranscriptStoreTests();
  await runTerminalSessionCliTests();
  await runTerminalSessionDemoTests();
  await runTraceRecorderTests();
  await runRuntimeFoundationSrcNewTests();
  await runContextFoundationSrcNewTests();
  await runModelFoundationSrcNewTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
