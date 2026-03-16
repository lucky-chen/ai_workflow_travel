import type { GateDecision, TraceEvent } from "../../Runtime/Schema/execution-unit.js";
import type { ChangedFile } from "../../Runtime/Schema/common.js";
import type { ComposeRunRequest } from "../../Runtime/Schema/compose-run.js";

export interface ParsedCommand {
  command: string;
  args: string[];
  options: Record<string, string | string[]>;
}

export interface CLICommandParser {
  parse(argv: string[]): ParsedCommand;
}

export interface CLIRequestMapper {
  map(command: ParsedCommand): Promise<ComposeRunRequest>;
}

export interface ReviewSession {
  reviewId: string;
  summary: string;
  changedPaths: string[];
  changedFiles: ChangedFile[];
}

export interface IReviewInteraction {
  waitForReview(reviewSession: ReviewSession): Promise<GateDecision>;
}

export interface TraceViewer {
  renderStatus(message: string): void;
  renderTrace(event: TraceEvent): void;
  renderResult(summary: string): void;
}

export interface ICLI {
  run(argv: string[]): Promise<number>;
}

export interface WorkspaceInitializer {
  initialize(workspaceRoot: string): Promise<string>;
}
