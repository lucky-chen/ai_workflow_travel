import { createApplicationRuntime } from "../app/composition-root.js";
import {
  CLIService,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
} from "../interface/cli/cli.js";
import { createCliBaselineTestRuntime } from "../testing/scenario-runtime.js";

async function main(): Promise<void> {
  const runtime = process.env.SDLC_TEST_SCENARIO === "fixed_workspace_baseline"
    ? createCliBaselineTestRuntime()
    : createApplicationRuntime();

  const cli = new CLIService(
    new DefaultCLICommandParser(),
    new DefaultCLIRequestMapper(),
    runtime.pipeline,
    new ConsoleTraceViewer(),
  );
  const exitCode = await cli.run(process.argv.slice(2));
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
