import type { RuntimeRequest } from "../../Runtime/Schema/runtime.js";
import type { CLIRequestMapper, ParsedCommand } from "./cli-types.js";

export class CliRequestMapper implements CLIRequestMapper {
  async map(command: ParsedCommand): Promise<RuntimeRequest> {
    if (command.command === "generate") {
      throw new Error('The legacy "generate" command has been removed. Use "run compose".');
    }

    if (command.command !== "run") {
      throw new Error(`Unsupported CLI command: ${command.command}`);
    }

    const [runMode, runTarget, fromTarget] = command.args;
    const params = this.readRuntimeParams(command.options);
    const workspaceRootOption = this.readSingleOption(command.options, "workdir")
      ?? this.readSingleOption(command.options, "workspace");
    if (!workspaceRootOption) {
      throw new Error("Missing required option: --workdir");
    }

    if (runMode === "unit") {
      if (!runTarget) {
        throw new Error("Missing required execution unit for run unit.");
      }

      return {
        mode: "unit",
        executionUnitId: runTarget,
        ...(Object.keys(params).length > 0 ? { params } : {}),
      };
    }

    if (runMode !== "compose") {
      throw new Error(`Unsupported run mode: ${command.args.join(" ") || "(empty)"}`);
    }

    if (runTarget === "standard") {
      return {
        mode: "compose",
        composeMode: "standard",
        ...(Object.keys(params).length > 0 ? { params } : {}),
      };
    }

    if (runTarget === "from") {
      if (!fromTarget) {
        throw new Error("Missing required execution unit for run compose from.");
      }

      return {
        mode: "compose",
        composeMode: "from",
        entryUnit: fromTarget,
        ...(Object.keys(params).length > 0 ? { params } : {}),
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

  private readRuntimeParams(options: ParsedCommand["options"]): Record<string, string> {
    const reservedKeys = new Set(["workdir", "workspace", "run-id", "runid"]);
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(options)) {
      if (reservedKeys.has(key)) {
        continue;
      }

      if (Array.isArray(value)) {
        throw new Error(`Option "--${key}" must be provided at most once.`);
      }

      params[this.toCamelCase(key)] = value;
    }

    return params;
  }

  private toCamelCase(input: string): string {
    return input.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  }
}
