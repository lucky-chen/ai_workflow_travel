import { createApplication } from "../../Runtime/application.js";
import {
  CLIService,
  ConsoleTraceViewer,
  DefaultCLICommandParser,
  DefaultCLIRequestMapper,
} from "../CliEntry/cli.js";
import { loadWorkspaceRuntimeOptions } from "../../Runtime/workspace-local-env.js";
import { createCliBaselineRuntimeOptions } from "../../testing/scenario-runtime.js";

async function main(): Promise<void> {
  const workspaceRoot = readWorkspaceRootFromArgv(process.argv.slice(2));
  const application = process.env.SDLC_TEST_SCENARIO === "fixed_workspace_baseline"
    ? createApplication(createCliBaselineRuntimeOptions())
    : createApplication(await loadWorkspaceRuntimeOptions(workspaceRoot));

  const cli = new CLIService(
    new DefaultCLICommandParser(),
    new DefaultCLIRequestMapper(),
    application,
    new ConsoleTraceViewer(),
  );
  const exitCode = await cli.run(process.argv.slice(2));
  process.exitCode = exitCode;
}

function readWorkspaceRootFromArgv(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--workspace") {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        return value;
      }
    }
  }

  return undefined;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
