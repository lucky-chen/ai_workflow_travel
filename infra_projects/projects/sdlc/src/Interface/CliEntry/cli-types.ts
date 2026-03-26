import type { ChangedFile } from "../../Runtime/Schema/runtime.js";
import type { GateDecision } from "../../SDK/QualityControl/Gate/change-gate.js";
import type { TraceEvent } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { RuntimeRequest } from "../../Runtime/Schema/runtime.js";

export interface ParsedCommand {
  command: string;
  args: string[];
  options: Record<string, string | string[]>;
}

export interface CLICommandParser {
  parse(argv: string[]): ParsedCommand;
}

export interface CLIRequestMapper {
  map(command: ParsedCommand): Promise<RuntimeRequest>;
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
