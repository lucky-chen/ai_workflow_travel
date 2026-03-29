import { runRuntimeFoundationSrcNewTests } from "./runtime-foundation-src-new.test.js";
import { runContextFoundationSrcNewTests } from "./context-foundation-src-new.test.js";
import { runModelFoundationSrcNewTests } from "./model-foundation-src-new.test.js";
import { runOrchestrationP1SrcNewTests } from "./orchestration-p1-src-new.test.js";
import { runCapabilityObservabilityP1SrcNewTests } from "./capability-observability-p1-src-new.test.js";
import { runApplicationP1SrcNewTests } from "./application-p1-src-new.test.js";
import { runRealProviderP1SrcNewTests } from "./real-provider-p1-src-new.test.js";

async function main(): Promise<void> {
  await runRuntimeFoundationSrcNewTests();
  await runContextFoundationSrcNewTests();
  await runModelFoundationSrcNewTests();
  await runOrchestrationP1SrcNewTests();
  await runCapabilityObservabilityP1SrcNewTests();
  await runApplicationP1SrcNewTests();
  await runRealProviderP1SrcNewTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
