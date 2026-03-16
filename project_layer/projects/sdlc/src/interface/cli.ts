// CLI module: parses user commands, maps them to workflow requests, and renders basic output.
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { GateDecision, IPipeline, LaunchTaskRequest, TraceEvent } from "../shared/contracts/pipeline.js";
import { TRACE_EVENT_TYPES } from "../shared/contracts/pipeline.js";
import { resolveStageIdAlias } from "../shared/contracts/pipeline.js";
import { ImplementationPlanContract } from "../contract/implementation-plan-contract.js";
import { resolveBundledResourcesDirectory } from "../shared/resource-resolver.js";
import type { ChangedFile } from "../shared/types/common.js";
import {
  getDefaultWorkspaceLocalEnvContent,
  resolveWorkspaceLocalEnvPath,
} from "../app/workspace-local-env.js";

export interface ParsedCommand {
  command: string;
  args: string[];
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
  private static readonly FLAG_OPTIONS = new Set(["single-step"]);

  parse(argv: string[]): ParsedCommand {
    const [command, ...rest] = argv;
    if (!command) {
      throw new Error("Missing CLI command.");
    }

    const options: Record<string, string | string[]> = {};
    const args: string[] = [];
    for (let index = 0; index < rest.length; index += 1) {
      const token = rest[index];
      if (!token.startsWith("--")) {
        args.push(token);
        continue;
      }

      const key = token.slice(2);
      if (DefaultCLICommandParser.FLAG_OPTIONS.has(key)) {
        options[key] = "true";
        continue;
      }

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
      args,
      options,
    };
  }
}

export class DefaultCLIRequestMapper implements CLIRequestMapper {
  async map(command: ParsedCommand): Promise<LaunchTaskRequest> {
    if (command.command === "run") {
      return this.mapRunCommand(command);
    }

    if (command.command !== "generate") {
      throw new Error(`Unsupported CLI command: ${command.command}`);
    }

    const stageOption = this.readSingleOption(command.options, "stage") ?? this.readSingleOption(command.options, "module");
    const workspace = this.readSingleOption(command.options, "workspace");
    const targetModule = this.readSingleOption(command.options, "target-module");
    const targetItem = this.readSingleOption(command.options, "target-item");
    const runId = this.readSingleOption(command.options, "run-id");
    const singleStep = this.readBooleanFlag(command.options, "single-step");

    if (!stageOption) {
      throw new Error("Missing required option: --stage");
    }

    if (!workspace) {
      throw new Error("Missing required option: --workspace");
    }

    const resolvedTargetName = targetItem ?? targetModule;
    const request = await this.buildWorkspaceLaunchRequest(stageOption, workspace, resolvedTargetName);
    const requestParams = {
      ...(request.params ?? {}),
      executionUnit: stageOption,
    };

    return {
      ...request,
      ...(runId ? { runId } : {}),
      ...(singleStep ? { stopAfterCurrentStage: true } : {}),
      ...(resolvedTargetName ? { targetModule: resolvedTargetName } : {}),
      params: requestParams,
    };
  }

  private async mapRunCommand(command: ParsedCommand): Promise<LaunchTaskRequest> {
    const [runMode, runTarget, fromTarget] = command.args;
    const workspace = this.readSingleOption(command.options, "workdir")
      ?? this.readSingleOption(command.options, "workspace");
    const targetModule = this.readSingleOption(command.options, "target-module");
    const targetItem = this.readSingleOption(command.options, "target-item");
    const runId = this.readSingleOption(command.options, "runid")
      ?? this.readSingleOption(command.options, "run-id");
    const singleStep = this.readBooleanFlag(command.options, "single-step");

    if (!workspace) {
      throw new Error("Missing required option: --workdir");
    }

    if (runMode === "unit") {
      if (!runTarget) {
        throw new Error("Missing required execution unit for run unit.");
      }

      return this.buildMappedRequest({
        executionUnit: runTarget,
        workspaceRoot: workspace,
        runId,
        singleStep,
        targetName: targetItem ?? targetModule,
        runtimeMode: "direct",
      });
    }

    if (runMode === "compose") {
      if (runTarget === "standard") {
        return this.buildMappedRequest({
          executionUnit: "requirement_design_generate",
          workspaceRoot: workspace,
          runId,
          singleStep,
          runtimeMode: "compose",
          composeMode: "standard",
        });
      }

      if (runTarget === "from") {
        if (!fromTarget) {
          throw new Error("Missing required execution unit for run compose from.");
        }

        return this.buildMappedRequest({
          executionUnit: fromTarget,
          workspaceRoot: workspace,
          runId,
          singleStep,
          targetName: targetItem ?? targetModule,
          runtimeMode: "compose",
          composeMode: "from",
        });
      }
    }

    throw new Error(`Unsupported run mode: ${command.args.join(" ") || "(empty)"}`);
  }

  private async buildMappedRequest(input: {
    executionUnit: string;
    workspaceRoot: string;
    runId?: string;
    singleStep: boolean;
    targetName?: string;
    runtimeMode: "direct" | "compose";
    composeMode?: "standard" | "from";
  }): Promise<LaunchTaskRequest> {
    const request = await this.buildWorkspaceLaunchRequest(
      input.executionUnit,
      input.workspaceRoot,
      input.targetName,
    );
    const requestParams = {
      ...(request.params ?? {}),
      executionUnit: input.executionUnit,
      runtimeMode: input.runtimeMode,
      ...(input.composeMode ? { composeMode: input.composeMode } : {}),
    };

    return {
      ...request,
      executionUnit: input.executionUnit,
      runtimeMode: input.runtimeMode,
      ...(input.composeMode ? { composeMode: input.composeMode } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.singleStep ? { stopAfterCurrentStage: true } : {}),
      ...(input.targetName ? { targetModule: input.targetName } : {}),
      params: requestParams,
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

  private readBooleanFlag(options: ParsedCommand["options"], key: string): boolean {
    const value = options[key];
    if (typeof value === "undefined") {
      return false;
    }

    if (Array.isArray(value)) {
      throw new Error(`Option "--${key}" must be provided at most once.`);
    }

    return value === "true";
  }

  private async buildWorkspaceLaunchRequest(
    stageId: string,
    workspaceRoot: string,
    targetName?: string,
  ): Promise<LaunchTaskRequest> {
    const resolvedStageId = resolveStageIdAlias(stageId);
    switch (resolvedStageId) {
      case "requirement_interpretation":
        return {
          startStageId: resolvedStageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/Requirement.md"),
          },
        };
      case "architecture_design":
        return {
          startStageId: resolvedStageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/Requirement.md"),
            ...(stageId === "architecture_design_update" || stageId === "architecture_design_contract"
              ? {
                  architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md"),
                }
              : {}),
          },
        };
      case "module_design":
        if (!targetName) {
          if (stageId === "item_design" || stageId.startsWith("item_design_")) {
            throw new Error(`Missing required option: --target-item for stage "${stageId}".`);
          }

          throw new Error(`Missing required option: --target-module for stage "${stageId}".`);
        }

        return {
          startStageId: resolvedStageId,
          workspaceRoot,
          inputArtifacts: {
            architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md"),
            module_descriptors: JSON.stringify({
              name: targetName,
              responsibilities: [],
            }),
          },
        };
      case "implementation_plan":
        return {
          startStageId: resolvedStageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/Requirement.md"),
            architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md"),
            module_design_documents: JSON.stringify(
              await this.readWorkspaceDirectoryFiles(workspaceRoot, "sdlc/docs/module_design"),
            ),
          },
        };
      case "overall_design_contract":
        return {
          startStageId: resolvedStageId,
          workspaceRoot,
          inputArtifacts: {
            requirement_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/Requirement.md"),
            architecture_document: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md"),
            module_design_documents: JSON.stringify(
              await this.readWorkspaceDirectoryFiles(workspaceRoot, "sdlc/docs/module_design"),
            ),
          },
        };
      case "validation":
        return {
          startStageId: resolvedStageId,
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
    const workPlan = await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/work_plan.yaml");
    const implementationPlanContract = new ImplementationPlanContract();
    const parsedWorkplan = implementationPlanContract.parseWorkPlan(workPlan);
    const firstStep = parsedWorkplan.steps[0];
    const firstBatch = firstStep?.batches[0];

    if (!firstStep || !firstBatch) {
      throw new Error("Work plan must contain at least one step and one batch.");
    }

    return {
      startStageId: "implementation_execution",
      workspaceRoot,
      inputArtifacts: {
        work_plan: "sdlc/docs/work_plan.yaml",
        parsed_work_plan: JSON.stringify(parsedWorkplan),
        current_step: JSON.stringify({
          stepId: firstStep.stepId,
          batchId: firstBatch.batchId,
        }),
        requirement_design: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/Requirement.md"),
        architecture_design: await this.readWorkspaceFile(workspaceRoot, "sdlc/docs/TechnicalArchitecture.md"),
        item_design_documents: JSON.stringify(
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
    const requestTarget = request.runtimeMode === "compose"
      ? `compose ${request.composeMode ?? "standard"}${request.executionUnit ? ` ${request.executionUnit}` : ""}`
      : request.executionUnit ?? request.startStageId;
    this.traceViewer.renderTrace({
      caller: "CLIService.run",
      stageId: request.startStageId,
      eventType: TRACE_EVENT_TYPES.taskLaunchRequested,
      summary: `Launching command "${parsed.command}" for target "${requestTarget}".`,
    });
    const taskId = await this.pipelineClient.launchTask(request);
    this.traceViewer.renderStatus(`Task launched: ${taskId}`);
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
