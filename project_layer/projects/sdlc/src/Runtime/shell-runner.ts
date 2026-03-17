import { exec } from "node:child_process";

export interface ShellResult {
  passed: boolean;
  logs: string;
}

export class ShellRunner {
  run(command: string): Promise<ShellResult> {
    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        resolve({
          passed: !error,
          logs: `${stdout}${stderr}`.trim(),
        });
      });
    });
  }
}
