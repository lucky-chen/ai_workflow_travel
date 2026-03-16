import type { ComposeRunRequest } from "../../Runtime/Schema/compose-run.js";
import type { CLIRequestMapper, ParsedCommand } from "./cli-types.js";

export class DefaultCLIRequestMapper implements CLIRequestMapper {
  async map(command: ParsedCommand): Promise<ComposeRunRequest> {
    if (command.command === "generate") {
      throw new Error('The legacy "generate" command has been removed. Use "run compose".');
    }

    if (command.command !== "run") {
      throw new Error(`Unsupported CLI command: ${command.command}`);
    }

    const [runMode, runTarget, fromTarget] = command.args;
    const workspaceRoot = this.readSingleOption(command.options, "workdir")
      ?? this.readSingleOption(command.options, "workspace");
    const runId = this.readSingleOption(command.options, "run-id")
      ?? this.readSingleOption(command.options, "runid");

    if (!workspaceRoot) {
      throw new Error("Missing required option: --workdir");
    }

    if (runMode === "unit") {
      throw new Error('The legacy "run unit" mode has been removed. Only "run compose" is available.');
    }

    if (runMode !== "compose") {
      throw new Error(`Unsupported run mode: ${command.args.join(" ") || "(empty)"}`);
    }

    if (runTarget === "standard") {
      return {
        workspaceRoot,
        composeMode: "standard",
        ...(runId ? { runId } : {}),
      };
    }

    if (runTarget === "from") {
      if (!fromTarget) {
        throw new Error("Missing required execution unit for run compose from.");
      }

      return {
        workspaceRoot,
        composeMode: "from",
        entryUnit: fromTarget,
        ...(runId ? { runId } : {}),
      };
    }

    throw new Error(`Unsupported run mode: ${command.args.join(" ") || "(empty)"}`);
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
}
