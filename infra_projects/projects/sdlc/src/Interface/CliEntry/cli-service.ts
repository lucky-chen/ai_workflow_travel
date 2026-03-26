import { TRACE_EVENT_TYPES } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { Application } from "../../Runtime/application.js";
import type {
  CLICommandParser,
  CLIRequestMapper,
  ICLI,
  ParsedCommand,
  TraceViewer,
  WorkspaceInitializer,
} from "./cli-types.js";
import { buildRuntimeContext, type RuntimeContextBuilder } from "./build-runtime-context.js";
import { ResourceWorkspaceInitializer } from "./workspace-initializer.js";

export class CLIService implements ICLI {
  constructor(
    private readonly commandParser: CLICommandParser,
    private readonly requestMapper: CLIRequestMapper,
    private readonly application: Application,
    private readonly traceViewer: TraceViewer,
    private readonly workspaceInitializer: WorkspaceInitializer = new ResourceWorkspaceInitializer(),
    private readonly runtimeContextBuilder: RuntimeContextBuilder = buildRuntimeContext,
  ) {}

  async run(argv: string[]): Promise<number> {
    const parsed = this.commandParser.parse(argv);
    if (parsed.command === "init") {
      return this.runInit(parsed);
    }

    const request = await this.requestMapper.map(parsed);
    const context = await this.runtimeContextBuilder(parsed);
    this.traceViewer.renderTrace({
      caller: "CLIService.run",
      eventType: TRACE_EVENT_TYPES.taskLaunchRequested,
      summary: this.buildLaunchSummary(parsed.command, request),
      metadata: this.buildLaunchMetadata(request),
    });
    const result = await this.application.run({ request, context });
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

  private buildLaunchSummary(command: string, request: Awaited<ReturnType<CLIRequestMapper["map"]>>): string {
    if (request.mode === "unit") {
      return `Launching command "${command}" for execution unit "${request.executionUnitId}".`;
    }

    return `Launching command "${command}" for compose mode "${request.composeMode}".`;
  }

  private buildLaunchMetadata(request: Awaited<ReturnType<CLIRequestMapper["map"]>>): Record<string, string> {
    if (request.mode === "unit") {
      return {
        mode: request.mode,
        executionUnitId: request.executionUnitId,
      };
    }

    return {
      mode: request.mode,
      composeMode: request.composeMode,
      ...(request.entryUnit ? { entryUnit: request.entryUnit } : {}),
    };
  }
}

function readSingleRequiredOption(options: ParsedCommand["options"], ...keys: string[]): string {
  const value = readOptionalSingleOption(options, ...keys);
  if (value) {
    return value;
  }

  throw new Error(`Missing required option: --${keys[0]}`);
}

function readOptionalSingleOption(options: ParsedCommand["options"], ...keys: string[]): string | undefined {
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
  return undefined;
}
