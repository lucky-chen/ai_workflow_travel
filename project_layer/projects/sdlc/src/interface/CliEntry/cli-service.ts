import type { IComposeRunService } from "../../Runtime/Schema/compose-run.js";
import { TRACE_EVENT_TYPES } from "../../Runtime/Schema/execution-unit.js";
import type {
  CLICommandParser,
  CLIRequestMapper,
  ICLI,
  ParsedCommand,
  TraceViewer,
  WorkspaceInitializer,
} from "./cli-types.js";
import { ResourceWorkspaceInitializer } from "./workspace-initializer.js";

export class CLIService implements ICLI {
  constructor(
    private readonly commandParser: CLICommandParser,
    private readonly requestMapper: CLIRequestMapper,
    private readonly composeRunService: IComposeRunService,
    private readonly traceViewer: TraceViewer,
    private readonly workspaceInitializer: WorkspaceInitializer = new ResourceWorkspaceInitializer(),
  ) {}

  async run(argv: string[]): Promise<number> {
    const parsed = this.commandParser.parse(argv);
    if (parsed.command === "init") {
      return this.runInit(parsed);
    }

    const request = await this.requestMapper.map(parsed);
    this.traceViewer.renderTrace({
      caller: "CLIService.run",
      eventType: TRACE_EVENT_TYPES.taskLaunchRequested,
      summary: `Launching command "${parsed.command}" for compose mode "${request.composeMode}".`,
      metadata: {
        composeMode: request.composeMode,
        ...(request.entryUnit ? { entryUnit: request.entryUnit } : {}),
      },
    });
    const result = await this.composeRunService.run(request);
    this.traceViewer.renderStatus(result.summary);
    this.traceViewer.renderResult(`Completed command: ${parsed.command}`);
    return 0;
  }

  private async runInit(parsed: ParsedCommand): Promise<number> {
    const workspace = readSingleRequiredOption(parsed.options, "workdir", "workspace");
    const resourcesDirectory = await this.workspaceInitializer.initialize(workspace);
    this.traceViewer.renderStatus(`Workspace initialized: ${workspace}`);
    this.traceViewer.renderResult(`Copied SDLC resources to ${resourcesDirectory}`);
    return 0;
  }
}

function readSingleRequiredOption(options: ParsedCommand["options"], ...keys: string[]): string {
  for (const key of keys) {
    const value = options[key];
    if (typeof value === "undefined") {
      continue;
    }

    if (Array.isArray(value)) {
      throw new Error(`Option "--${key}" must be provided at most once.`);
    }

    return value;
  }

  throw new Error(`Missing required option: --${keys[0]}`);
}
