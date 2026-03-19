import { runHelloServiceDocumentGenerationFailureTest } from "./hello-service-document-generation-flow-failure.test.mjs";
import { runHelloServiceUnitFlowFailureTest } from "./hello-service-unit-flow-failure.test.mjs";

export async function runHelloServiceBaselineFailureTest() {
  await runHelloServiceDocumentGenerationFailureTest();
  await runHelloServiceUnitFlowFailureTest();
  process.stdout.write("Hello-service baseline failure aggregation passed.\n");
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  runHelloServiceBaselineFailureTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
