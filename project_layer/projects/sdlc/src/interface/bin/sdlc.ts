import { createApplication } from "../../Runtime/application.js";
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
  const application = createApplication(await loadApplicationConfigFromCommand(parsed));

  const cli = new CLIService(
    parser,
    new CliRequestMapper(),
    application,
    new ConsoleTraceViewer(),
  );
  const exitCode = await cli.run(argv);
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
