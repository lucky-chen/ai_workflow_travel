import { runHelloServiceContractFailureTest } from "./hello-service-architecture-contract-failure.test.mjs";
import { runHelloServiceFunctionalTest } from "./hello-service-document-generation-flow.test.mjs";
import { runHelloServiceRealLlmTest } from "./hello-service-real-llm-unit-flow.test.mjs";
import { runHelloServiceSuccessTest } from "./hello-service-unit-flow-success.test.mjs";

export async function runHelloServiceBaselineTest() {
  await runHelloServiceSuccessTest();
  await runHelloServiceFunctionalTest();
  await runHelloServiceContractFailureTest();
  await runHelloServiceRealLlmTest();
  process.stdout.write("All hello-service tests passed.\n");
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  runHelloServiceBaselineTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
