import type { CLICommandParser, ParsedCommand } from "./cli-types.js";

export class CliCommandParser implements CLICommandParser {
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
