import { createApplication } from "../../Runtime/application.js";
import { createCliBaselineRuntimeOptions } from "../../testing/scenario-runtime.js";
import {
  CLIService,
  ConsoleTraceViewer,
  CliCommandParser,
  CliRequestMapper,
  loadApplicationConfigFromCommand,
} from "../CliEntry/cli.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parser = new CliCommandParser();
  const parsed = parser.parse(argv);
  const application = createApplication(mergeApplicationConfig(
    await loadApplicationConfigFromCommand(parsed),
    loadScenarioApplicationConfig(),
  ));

  const cli = new CLIService(
    parser,
    new CliRequestMapper(),
    application,
    new ConsoleTraceViewer(),
  );
  const exitCode = await cli.run(argv);
  process.exitCode = exitCode;
}

function loadScenarioApplicationConfig() {
  if (process.env.SDLC_TEST_SCENARIO === "fixed_workspace_baseline") {
    return createCliBaselineRuntimeOptions();
  }

  return {};
}

function mergeApplicationConfig(
  baseConfig: Awaited<ReturnType<typeof loadApplicationConfigFromCommand>>,
  overrideConfig: Awaited<ReturnType<typeof loadApplicationConfigFromCommand>>,
) {
  return {
    ...baseConfig,
    ...overrideConfig,
    llmExecutor: overrideConfig.llmExecutor ?? baseConfig.llmExecutor,
    llmExecutorInstance: overrideConfig.llmExecutorInstance ?? baseConfig.llmExecutorInstance,
    changeGate: overrideConfig.changeGate ?? baseConfig.changeGate,
  };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
