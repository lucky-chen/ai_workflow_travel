import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  invokeMcpTool,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  writeRequirementContractSuccessFixture,
} from "./hello-service-test-helpers.mjs";

const generateRunId = "7201-mcp-requirement-generate";
const contractRunId = "7202-mcp-requirement-contract";

export async function runHelloServiceMcpGenerateContractSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    const generateResult = await invokeMcpTool(
      targetWorkspaceRoot,
      {
        name: "requirement_design_generate",
        arguments: {
          project_name: "hello-service",
          user_comment: "Generate requirement for hello-service",
        },
      },
      {
        runId: generateRunId,
      },
    );
    assert.deepEqual(generateResult, {
      status: "success",
      message: "Requirement document generated. Persisted to sdlc/docs/Requirement.md.",
      files: [
        {
          path: "sdlc/docs/Requirement.md",
          role: "requirement_design",
        },
      ],
    });

    await writeRequirementContractSuccessFixture(targetWorkspaceRoot);

    const contractResult = await invokeMcpTool(
      targetWorkspaceRoot,
      {
        name: "requirement_design_contract",
        arguments: {
          project_name: "hello-service",
        },
      },
      {
        runId: contractRunId,
      },
    );
    assert.equal(contractResult.status, "success");
    assert.equal(contractResult.files?.[0]?.role, "requirement_design_contract_result");
    assert.equal(contractResult.files?.[0]?.path, path.join("dist", "sdlc", contractRunId, "requirement_design_contract_result.json"));

    const persisted = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", contractRunId, "requirement_design_contract_result.json"),
    );
    assert.equal(persisted.passed, true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceMcpGenerateContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
