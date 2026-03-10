import { runHelloServiceContractFailureTest } from "./hello-service-contract-failure.test.mjs";
import { runHelloServiceSuccessTest } from "./hello-service-success.test.mjs";

await runHelloServiceSuccessTest();
await runHelloServiceContractFailureTest();
process.stdout.write("All functional tests passed.\n");
