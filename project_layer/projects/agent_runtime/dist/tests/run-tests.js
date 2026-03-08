import { runAgentRuntimeTests } from "./agent-runtime.test.js";
import { runExecutionStrategySelectorTests } from "./execution-strategy-selector.test.js";
async function main() {
    await runAgentRuntimeTests();
    await runExecutionStrategySelectorTests();
    process.stdout.write("All tests passed.\n");
}
main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
});
