import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import { ImplementationContractService } from "../src/contract/implementation-contract/implementation-contract.js";
import type { IContractChecker } from "../src/shared/contracts/pipeline.js";

export async function runImplementationContractTests(): Promise<void> {
  const workdir = await createTempDir("implementation-contract-");
  const checker = ImplementationContractService.create();

  try {
    await testImplementationContractSuccess(checker, workdir);
    await testImplementationContractFailure(checker, workdir);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function testImplementationContractSuccess(
  checker: IContractChecker,
  workspaceRoot: string,
): Promise<void> {
  const successResult = await checker.check(
    {
      taskId: "task-1",
      stageId: "implementation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
      params: {
        testCommand: 'node -e "process.exit(0)"',
      },
    },
    {
      stageId: "implementation",
      success: true,
      summary: "Generated implementation output.",
      artifacts: {
        changedFiles: [],
        summary: "Generated implementation output.",
      },
    },
  );

  assert.deepEqual(successResult, {
    passed: true,
    summary: 'Test command passed: node -e "process.exit(0)"',
    issues: [],
  });
}

async function testImplementationContractFailure(
  checker: IContractChecker,
  workspaceRoot: string,
): Promise<void> {
  const failResult = await checker.check(
    {
      taskId: "task-2",
      stageId: "implementation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
      params: {
        testCommand: 'node -e "process.stderr.write(\'contract failed\\n\'); process.exit(1)"',
      },
    },
    {
      stageId: "implementation",
      success: true,
      summary: "Generated implementation output.",
      artifacts: {
        changedFiles: [{ path: "src/a.ts", operation: "update", content: "export {};\n" }],
        summary: "Generated implementation output.",
      },
    },
  );

  assert.equal(failResult.passed, false);
  assert.equal(
    failResult.summary,
    'Test command failed: node -e "process.stderr.write(\'contract failed\\n\'); process.exit(1)"',
  );
  assert.equal(failResult.issues.length, 1);
  assert.equal(failResult.issues[0]?.checkItem, "implementation-contract");
  assert.equal(failResult.issues[0]?.severity, "high");
  assert.equal(failResult.issues[0]?.message.includes("contract failed"), true);
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}
