import assert from "node:assert/strict";

import { ShellRunner } from "../src/workflow/validation/shell-runner.js";

export async function runShellRunnerTests(): Promise<void> {
  await testShellRunnerRejectsEmptyCommand();
  await testShellRunnerReturnsPassedResult();
  await testShellRunnerReturnsFailedResult();
}

async function testShellRunnerRejectsEmptyCommand(): Promise<void> {
  const runner = new ShellRunner();

  await assert.rejects(
    runner.run("   "),
    /Shell command must not be empty\./,
  );
}

async function testShellRunnerReturnsPassedResult(): Promise<void> {
  const runner = new ShellRunner();
  const result = await runner.run('node -e "process.stdout.write(\'ok\'); process.exit(0)"');

  assert.deepEqual(result, {
    passed: true,
    summary: 'Shell command passed: node -e "process.stdout.write(\'ok\'); process.exit(0)"',
    command: 'node -e "process.stdout.write(\'ok\'); process.exit(0)"',
    exit_code: 0,
    logs: "ok",
  });
}

async function testShellRunnerReturnsFailedResult(): Promise<void> {
  const runner = new ShellRunner();
  const result = await runner.run(
    'node -e "process.stderr.write(\'failed\\n\'); process.exit(1)"',
  );

  assert.deepEqual(result, {
    passed: false,
    summary: 'Shell command failed: node -e "process.stderr.write(\'failed\\n\'); process.exit(1)"',
    command: 'node -e "process.stderr.write(\'failed\\n\'); process.exit(1)"',
    exit_code: 1,
    logs: "failed",
  });
}
