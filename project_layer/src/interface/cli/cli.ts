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
    action: string;
    summary: string;
    comment?: string;
  }>;
}

export interface TraceViewer {
  renderStatus(message: string): void;
  renderResult(summary: string): void;
}

export interface ICLI {
  run(argv: string[]): Promise<number>;
}

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
