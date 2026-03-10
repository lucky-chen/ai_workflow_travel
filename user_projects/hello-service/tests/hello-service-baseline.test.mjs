import { runHelloServiceContractFailureTest } from "./hello-service-contract-failure.test.mjs";
import { runHelloServiceFunctionalTest } from "./hello-service-functional.test.mjs";
import { runHelloServiceRealLlmTest } from "./hello-service-real-llm.test.mjs";
import { runHelloServiceSuccessTest } from "./hello-service-success.test.mjs";

await runHelloServiceSuccessTest();
await runHelloServiceFunctionalTest();
await runHelloServiceContractFailureTest();
await runHelloServiceRealLlmTest();
process.stdout.write("All hello-service tests passed.\n");
