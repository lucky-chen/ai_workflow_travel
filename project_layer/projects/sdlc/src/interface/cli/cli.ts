// CLI module: parses user commands, maps them to workflow requests, and renders basic output.
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { GateDecision, IPipeline, LaunchTaskRequest, TraceEvent } from "../../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../../shared/contracts/pipeline.js";
import { ImplementationPlanContract } from "../../contract/implementation-plan-contract/implementation-plan-contract.js";
import { resolveBundledResourcesDirectory } from "../../shared/resources/resource-resolver.js";
import type { ChangedFile } from "../../shared/types/common.js";
import {
  getDefaultWorkspaceLocalEnvContent,
  resolveWorkspaceLocalEnvPath,
} from "../../app/workspace-local-env.js";

export interface ParsedCommand {
  command: string;
  options: Record<string, string | string[]>;
}

export interface CLICommandParser {
  parse(argv: string[]): ParsedCommand;
}

export interface CLIRequestMapper {
  map(command: ParsedCommand): Promise<LaunchTaskRequest>;
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
  changedPaths: string[];
  changedFiles: ChangedFile[];
}

// Public API: command-line entry interface exposed to the executable layer.
export interface ICLI {
  run(argv: string[]): Promise<number>;
}

export interface WorkspaceInitializer {
  initialize(workspaceRoot: string): Promise<string>;
}

export class DefaultCLICommandParser implements CLICommandParser {
  parse(argv: string[]): ParsedCommand {
    const [command, ...rest] = argv;
    if (!command) {
      throw new Error("Missing CLI command.");
    }

    const options: Record<string, string | string[]> = {};
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

      const existing = options[key];
      if (typeof existing === "undefined") {
        options[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        options[key] = [existing, value];
      }
      index += 1;
    }

    return {
      command,
      options,
    };
  }
}

export class DefaultCLIRequestMapper implements CLIRequestMapper {
  async map(command: ParsedCommand): Promise<LaunchTaskRequest> {
    if (command.command !== "generate") {
      throw new Error(`Unsupported CLI command: ${command.command}`);
    }

    const stageOption = this.readSingleOption(command.options, "stage") ?? this.readSingleOption(command.options, "module");
    const workspace = this.readSingleOption(command.options, "workspace");
    const targetModule = this.readSingleOption(command.options, "target-module");

    if (!stageOption) {
      throw new Error("Missing required option: --stage");
    }

    if (!workspace) {
      throw new Error("Missing required option: --workspace");
    }

    const request = await this.buildWorkspaceLaunchRequest(stageOption, workspace, targetModule);

    return {
      ...request,
      ...(targetModule ? { targetModule } : {}),
    };
  }

  private readSingleOption(
    options: ParsedCommand["options"],
    key: string,
  ): string | undefined {
    const value = options[key];
    if (typeof value === "undefined") {
      return undefined;
    }

    if (Array.isArray(value)) {
      throw new Error(`Option "--${key}" must be provided at most once.`);
    }

    return value;
  }

  private async buildWorkspaceLaunchRequest(
    stageId: string,
    workspaceRoot: string,
    targetModule?: string,
  ): Promise<LaunchTaskRequest> {
    switch (stageId) {
      case "requirement_interpretation":
        return {
          startStageId: stageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/requirements/Requirement.md"),
          },
        };
      case "architecture_design":
        return {
          startStageId: stageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/requirements/Requirement.md"),
          },
        };
      case "module_design":
        if (!targetModule) {
          throw new Error('Missing required option: --target-module for stage "module_design".');
        }

        return {
          startStageId: stageId,
          workspaceRoot,
          inputArtifacts: {
            architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/architecture/TechnicalArchitecture.md"),
            module_descriptors: JSON.stringify({
              name: targetModule,
              responsibilities: [],
            }),
          },
        };
      case "implementation_plan":
        return {
          startStageId: stageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/requirements/Requirement.md"),
            architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/architecture/TechnicalArchitecture.md"),
            module_design_documents: JSON.stringify(
              await this.readWorkspaceDirectoryFiles(workspaceRoot, "sdlc/docs/module_design"),
            ),
          },
        };
      case "validation":
        return {
          startStageId: stageId,
          workspaceRoot,
          inputArtifacts: {},
        };
      case "implementation_execution":
        return this.buildImplementationExecutionLaunchRequest(workspaceRoot);
      default:
        throw new Error(`CLI launch baseline does not support stage "${stageId}".`);
    }
  }

  private async buildImplementationExecutionLaunchRequest(workspaceRoot: string): Promise<LaunchTaskRequest> {
    const implementationWorkplan = await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/CodeGenerationExecutionPlan.md");
    const implementationPlanContract = new ImplementationPlanContract();
    const parsedWorkplan = implementationPlanContract.parseWorkPlan(implementationWorkplan);
    const firstStep = parsedWorkplan.steps[0];
    const firstBatch = firstStep?.batches[0];

    if (!firstStep || !firstBatch) {
      throw new Error("Implementation workplan must contain at least one step and one batch.");
    }

    return {
      startStageId: "implementation_execution",
      workspaceRoot,
      inputArtifacts: {
        implementation_workplan: "sdlc/docs/CodeGenerationExecutionPlan.md",
        parsed_implementation_workplan: JSON.stringify(parsedWorkplan),
        current_step: JSON.stringify({
          stepId: firstStep.stepId,
          batchId: firstBatch.batchId,
        }),
        requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/requirements/Requirement.md"),
        architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/architecture/TechnicalArchitecture.md"),
        module_design_documents: JSON.stringify(
          await this.readWorkspaceDirectoryPaths(workspaceRoot, "sdlc/docs/module_design"),
        ),
      },
    };
  }

  private async readWorkspaceFile(workspaceRoot: string, relativePath: string): Promise<string> {
    const absolutePath = path.join(workspaceRoot, relativePath);

    try {
      return await readFile(absolutePath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Missing required workspace file: ${relativePath}`);
      }

      throw error;
    }
  }

  private async readWorkspaceDirectoryFiles(workspaceRoot: string, relativeDirectory: string): Promise<string[]> {
    const directoryPath = path.join(workspaceRoot, relativeDirectory);
    const filePaths = await this.readWorkspaceDirectoryMarkdownEntries(directoryPath, relativeDirectory);

    return Promise.all(
      filePaths.map((entry) => readFile(path.join(directoryPath, entry), "utf8")),
    );
  }

  private async readWorkspaceDirectoryPaths(workspaceRoot: string, relativeDirectory: string): Promise<string[]> {
    const directoryPath = path.join(workspaceRoot, relativeDirectory);
    const filePaths = await this.readWorkspaceDirectoryMarkdownEntries(directoryPath, relativeDirectory);

    return filePaths.map((entry) => path.posix.join(relativeDirectory, entry));
  }

  private async readWorkspaceDirectoryMarkdownEntries(directoryPath: string, relativeDirectory: string): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Missing required workspace directory: ${relativeDirectory}`);
      }

      throw error;
    }

    const fileEntries = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .sort((left, right) => left.name.localeCompare(right.name));

    if (fileEntries.length === 0) {
      throw new Error(`Missing required markdown files in workspace directory: ${relativeDirectory}`);
    }

    return fileEntries.map((entry) => entry.name);
  }
}

export class ResourceWorkspaceInitializer implements WorkspaceInitializer {
  async initialize(workspaceRoot: string): Promise<string> {
    const targetRoot = path.join(workspaceRoot, "sdlc");
    const targetResourcesDirectory = path.join(targetRoot, "resources");
    const targetLocalEnvPath = resolveWorkspaceLocalEnvPath(workspaceRoot);
    const sourceResourcesDirectory = await resolveBundledResourcesDirectory();

    await mkdir(targetRoot, { recursive: true });
    await cp(sourceResourcesDirectory, targetResourcesDirectory, { recursive: true });
    await this.ensureLocalEnvFile(targetLocalEnvPath);

    return targetResourcesDirectory;
  }

  private async ensureLocalEnvFile(targetPath: string): Promise<void> {
    try {
      await writeFile(targetPath, getDefaultWorkspaceLocalEnvContent(), { encoding: "utf8", flag: "wx" });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "EEXIST") {
        throw error;
      }
    }
  }
}

export class ConsoleTraceViewer implements TraceViewer {
  renderStatus(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  renderTrace(event: TraceEvent): void {
    const scope = event.stageId ? `[${event.stageId}] ` : "";
    process.stdout.write(`${scope}${event.eventType}: ${event.summary}\n`);
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
    this.promptAdapter.write(`Review ${reviewSession.reviewId}: ${reviewSession.summary}\n`);
    if (reviewSession.changedPaths.length > 0) {
      this.promptAdapter.write(`Changed paths: ${reviewSession.changedPaths.join(", ")}\n`);
    }
    for (const changedFile of reviewSession.changedFiles) {
      this.promptAdapter.write(
        `- ${changedFile.operation} ${changedFile.path}${changedFile.content ? "\n" + changedFile.content : ""}\n`,
      );
    }

    const answer = (await this.promptAdapter.ask("Apply changes? [apply/reject/comment]: ")).trim().toLowerCase();
    if (answer === "reject") {
      return {
        action: "reject",
        summary: "User rejected the change set.",
      };
    }

    if (answer === "comment") {
      const comment = (await this.promptAdapter.ask("Enter review comment: ")).trim();
      return {
        action: "wait",
        summary: "User requested changes before apply.",
        comment,
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
    private readonly workspaceInitializer: WorkspaceInitializer = new ResourceWorkspaceInitializer(),
  ) {}

  async run(argv: string[]): Promise<number> {
    const parsed = this.commandParser.parse(argv);
    if (parsed.command === "init") {
      return this.runInit(parsed);
    }

    const request = await this.requestMapper.map(parsed);
    this.traceViewer.renderTrace({
      taskId: "pending",
      caller: "CLIService.run",
      stageId: request.startStageId,
      eventType: TRACE_EVENT_TYPES.taskLaunchRequested,
      summary: `Launching command "${parsed.command}" for stage "${request.startStageId}".`,
    });
    const taskId = await this.pipelineClient.launchTask(request);
    this.traceViewer.renderStatus(`Task launched: ${taskId}`);
    this.traceViewer.renderResult(`Completed command: ${parsed.command}`);
    return 0;
  }

  private async runInit(parsed: ParsedCommand): Promise<number> {
    const workspace = readSingleRequiredOption(parsed.options, "workspace");
    const resourcesDirectory = await this.workspaceInitializer.initialize(workspace);
    this.traceViewer.renderStatus(`Workspace initialized: ${workspace}`);
    this.traceViewer.renderResult(`Copied SDLC resources to ${resourcesDirectory}`);
    return 0;
  }
}

function readSingleRequiredOption(options: ParsedCommand["options"], key: string): string {
  const value = options[key];
  if (typeof value === "undefined") {
    throw new Error(`Missing required option: --${key}`);
  }

  if (Array.isArray(value)) {
    throw new Error(`Option "--${key}" must be provided at most once.`);
  }

  return value;
}
