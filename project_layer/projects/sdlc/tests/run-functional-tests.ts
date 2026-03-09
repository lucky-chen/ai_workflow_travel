import { runHelloServiceBaselineTests } from "./hello-service/hello-service-baseline.test.js";

async function main(): Promise<void> {
  await runHelloServiceBaselineTests();
  process.stdout.write("All functional tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
