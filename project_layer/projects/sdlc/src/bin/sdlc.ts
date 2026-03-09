import { createApplicationRuntime } from "../app/composition-root.js";
import {
  CLIService,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
} from "../interface/cli/cli.js";
import { createCliBaselineRuntimeOptions } from "../testing/scenario-runtime.js";

async function main(): Promise<void> {
  const runtime = process.env.SDLC_TEST_SCENARIO === "fixed_workspace_baseline"
    ? createApplicationRuntime(createCliBaselineRuntimeOptions())
    : createApplicationRuntime();
  const fixedTaskId = process.env.SDLC_TEST_TASK_ID?.trim();
  const pipeline = fixedTaskId
    ? {
        launchTask(request: Parameters<typeof runtime.pipeline.launchTask>[0]) {
          return runtime.pipeline.launchTask({
            ...request,
            taskId: request.taskId ?? fixedTaskId,
          });
        },
      }
    : runtime.pipeline;

  const cli = new CLIService(
    new DefaultCLICommandParser(),
    new DefaultCLIRequestMapper(),
    pipeline,
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
