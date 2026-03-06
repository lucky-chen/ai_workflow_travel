// CLI module: parses user commands, maps them to workflow requests, and renders basic output.
import type { IPipeline, LaunchTaskRequest } from "../../shared/contracts/pipeline.js";

export interface ParsedCommand {
  command: string;
  options: Record<string, string>;
}

export interface CLICommandParser {
  parse(argv: string[]): ParsedCommand;
}

export interface CLIRequestMapper {
  map(command: ParsedCommand): LaunchTaskRequest;
}

export interface IReviewInteraction {
  waitForReview(reviewSession: { reviewId: string; summary: string }): Promise<{
    action: "apply" | "reject" | "wait";
    summary: string;
    comment?: string;
  }>;
}

export interface TraceViewer {
  renderStatus(message: string): void;
  renderResult(summary: string): void;
}

// Public API: command-line entry interface exposed to the executable layer.
export interface ICLI {
  run(argv: string[]): Promise<number>;
}

// Public API: CLI entry implementation that dispatches user commands into workflow requests.
export class CLIService implements ICLI {
  constructor(
    private readonly commandParser: CLICommandParser,
    private readonly requestMapper: CLIRequestMapper,
    private readonly pipelineClient: IPipeline,
    private readonly traceViewer: TraceViewer,
  ) {}

  async run(argv: string[]): Promise<number> {
    const parsed = this.commandParser.parse(argv);
    const request = this.requestMapper.map(parsed);
    const taskId = await this.pipelineClient.launchTask(request);
    this.traceViewer.renderStatus(`Task launched: ${taskId}`);
    return 0;
  }
}
