import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ImplementationContract } from "../../src/contract/implementation-contract.js";
import { ChangeApplier } from "../../src/execution/implementation-generator/change-applier.js";
import type { IContractChecker } from "../../src/shared/contracts/pipeline.js";

export async function runImplementationContractTests(): Promise<void> {
  const workdir = await createTempDir("implementation-contract-");
  const checker = ImplementationContract.create();
  const changeApplier = new ChangeApplier();

  try {
    await testImplementationContractSuccess(checker, changeApplier, workdir);
    await testImplementationContractFailure(checker, workdir);
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function testImplementationContractSuccess(
  checker: IContractChecker,
  changeApplier: ChangeApplier,
  workspaceRoot: string,
): Promise<void> {
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "src", "generated.ts"), "export const generated = false;\n", "utf8");
  await changeApplier.applyChangedFiles(
    [
      {
        path: "src/generated.ts",
        operation: "update",
        content: "export const generated = true;\n",
      },
    ],
    workspaceRoot,
  );

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
  assert.equal(
    await readFile(path.join(workspaceRoot, "src", "generated.ts"), "utf8"),
    "export const generated = true;\n",
  );
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
