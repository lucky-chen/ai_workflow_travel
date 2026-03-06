// CLI module: parses user commands, maps them to workflow requests, and renders basic output.
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { IPipeline, LaunchTaskRequest } from "../../shared/contracts/pipeline.js";
import type { GateDecision } from "../../shared/contracts/change-gate.js";
import type { ChangedFile } from "../../shared/types/common.js";
import type { StringMap } from "../../shared/types/common.js";

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
  renderResult(summary: string): void;
}

export interface ReviewSession {
  reviewId: string;
  summary: string;
  changedFiles: ChangedFile[];
}

// Public API: command-line entry interface exposed to the executable layer.
export interface ICLI {
  run(argv: string[]): Promise<number>;
}

export class DefaultCLICommandParser implements CLICommandParser {
  parse(argv: string[]): ParsedCommand {
    const [command, ...rest] = argv;
    if (!command) {
      throw new Error("Missing CLI command.");
    }

    const options: Record<string, string> = {};
    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (!token.startsWith("--")) {
        throw new Error(`Unexpected CLI token: ${token}`);
      }

      const key = token.slice(2);
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for CLI option: --${key}`);
      }

      options[key] = value;
      index += 1;
    }

    return {
      command,
      options,
    };
  }
}

export class DefaultCLIRequestMapper implements CLIRequestMapper {
  map(command: ParsedCommand): LaunchTaskRequest {
    if (command.command !== "generate") {
      throw new Error(`Unsupported CLI command: ${command.command}`);
    }

    const stageId = command.options.module;
    const input = command.options.input;
    const workspace = command.options.workspace;

    if (!stageId) {
      throw new Error("Missing required option: --module");
    }

    if (!input) {
      throw new Error("Missing required option: --input");
    }

    if (!workspace) {
      throw new Error("Missing required option: --workspace");
    }

    return {
      startStageId: stageId,
      workspaceRoot: workspace,
      inputArtifacts: {
        moduleDesign: input,
      },
    };
  }
}

export class ConsoleTraceViewer implements TraceViewer {
  renderStatus(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  renderResult(summary: string): void {
    process.stdout.write(`${summary}\n`);
  }
}

export interface ReviewPromptAdapter {
  ask(prompt: string): Promise<string>;
  write(message: string): void;
}

export class ConsoleReviewInteraction implements IReviewInteraction {
  constructor(private readonly promptAdapter: ReviewPromptAdapter = new ReadlinePromptAdapter()) {}

  async waitForReview(reviewSession: ReviewSession): Promise<GateDecision> {
    this.promptAdapter.write(`Review: ${reviewSession.summary}\n`);
    for (const changedFile of reviewSession.changedFiles) {
      this.promptAdapter.write(
        `- ${changedFile.operation} ${changedFile.path}${changedFile.content ? "\n" + changedFile.content : ""}\n`,
      );
    }

    const answer = (await this.promptAdapter.ask("Apply changes? [apply/reject]: ")).trim().toLowerCase();
    if (answer === "reject") {
      return {
        action: "reject",
        summary: "User rejected the change set.",
      };
    }

    return {
      action: "apply",
      summary: "User approved the change set.",
    };
  }
}

class ReadlinePromptAdapter implements ReviewPromptAdapter {
  async ask(prompt: string): Promise<string> {
    const rl = createInterface({ input, output });
    try {
      return await rl.question(prompt);
    } finally {
      rl.close();
    }
  }

  write(message: string): void {
    output.write(message);
  }
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
    this.traceViewer.renderResult(`Completed command: ${parsed.command}`);
    return 0;
  }
}
