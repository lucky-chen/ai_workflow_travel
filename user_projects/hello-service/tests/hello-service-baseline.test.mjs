import { runHelloServiceContractFailureTest } from "./hello-service-contract-failure.test.mjs";
import { runHelloServiceRealLlmTest } from "./hello-service-real-llm.test.mjs";
import { runHelloServiceSuccessTest } from "./hello-service-success.test.mjs";

await runHelloServiceSuccessTest();
await runHelloServiceContractFailureTest();
await runHelloServiceRealLlmTest();
process.stdout.write("All functional tests passed.\n");
