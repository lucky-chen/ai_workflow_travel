import path from "node:path";

import { ShellRunner } from "../validation/shell-runner.js";

export interface ImplementationGitCommitContext {
  workspaceRoot: string;
  stepId: string;
}

export interface IImplementationGitCommitter {
  commit(context: ImplementationGitCommitContext): Promise<void>;
}

export class GitProcessCommitter implements IImplementationGitCommitter {
  constructor(private readonly shellRunner: ShellRunner = new ShellRunner()) {}

  async commit(context: ImplementationGitCommitContext): Promise<void> {
    const workspaceRoot = this.quotePathForShell(context.workspaceRoot);
    await this.runGitCommand(`cd ${workspaceRoot} && git add -A`);
    await this.runGitCommand(
      `cd ${workspaceRoot} && git commit -m ${this.quoteStringForShell(`[AI] gpt-5.4: accept implementation step ${context.stepId}`)}`
      + ` -m ${this.quoteStringForShell("Target:\nimplementation execution.\n\nChange items:\n1. Apply accepted generated changes.\n2. Update accepted implementation workplan state.\n3. Commit accepted implementation changes.")}`,
    );
  }

  private async runGitCommand(command: string): Promise<void> {
    const result = await this.shellRunner.run(command);
    if (!result.passed) {
      throw new Error(result.logs?.trim() || `Git command failed: ${command}`);
    }
  }

  private quotePathForShell(value: string): string {
    return this.quoteStringForShell(path.resolve(value));
  }

  private quoteStringForShell(value: string): string {
    return `'${value.replaceAll("'", `'\\''`)}'`;
  }
}
