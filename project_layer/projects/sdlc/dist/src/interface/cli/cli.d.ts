import type { GateDecision, IPipeline, LaunchTaskRequest, TraceEvent } from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
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
    waitForReview(reviewSession: ReviewSession): Promise<GateDecision>;
}
export interface TraceViewer {
    renderStatus(message: string): void;
    renderTrace(event: TraceEvent): void;
    renderResult(summary: string): void;
}
export interface ReviewSession {
    reviewId: string;
    summary: string;
    changedFiles: ChangedFile[];
}
export interface ICLI {
    run(argv: string[]): Promise<number>;
}
export declare class DefaultCLICommandParser implements CLICommandParser {
    parse(argv: string[]): ParsedCommand;
}
export declare class DefaultCLIRequestMapper implements CLIRequestMapper {
    map(command: ParsedCommand): LaunchTaskRequest;
}
export declare class ConsoleTraceViewer implements TraceViewer {
    renderStatus(message: string): void;
    renderTrace(event: TraceEvent): void;
    renderResult(summary: string): void;
}
export interface ReviewPromptAdapter {
    ask(prompt: string): Promise<string>;
    write(message: string): void;
}
export declare class ConsoleReviewInteraction implements IReviewInteraction {
    private readonly promptAdapter;
    constructor(promptAdapter?: ReviewPromptAdapter);
    waitForReview(reviewSession: ReviewSession): Promise<GateDecision>;
}
export declare class CLIService implements ICLI {
    private readonly commandParser;
    private readonly requestMapper;
    private readonly pipelineClient;
    private readonly traceViewer;
    constructor(commandParser: CLICommandParser, requestMapper: CLIRequestMapper, pipelineClient: IPipeline, traceViewer: TraceViewer);
    run(argv: string[]): Promise<number>;
}
