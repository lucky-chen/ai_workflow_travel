import { spawn } from "node:child_process";

export interface ShellResult {
  passed: boolean;
  summary: string;
  command: string;
  exit_code: number;
  logs?: string;
}

export class ShellRunner {
  async run(command: string): Promise<ShellResult> {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      throw new Error("Shell command must not be empty.");
    }

    return new Promise<ShellResult>((resolve, reject) => {
      const child = spawn(trimmedCommand, {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);

      child.on("close", (code) => {
        const passed = code === 0;
        const logs = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");

        resolve({
          passed,
          summary: passed
            ? `Shell command passed: ${trimmedCommand}`
            : `Shell command failed: ${trimmedCommand}`,
          command: trimmedCommand,
          exit_code: code ?? 1,
          logs: logs || undefined,
        });
      });
    });
  }
}
