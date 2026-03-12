import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArchitectureDesignContract } from "../../src/contract/architecture-design-contract.js";
import {
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";
import { runArchitectureContractStyleChecks } from "./architecture-contract-test-helper.js";

export async function runArchitectureDesignContractTests(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-contract-");

  try {
    await testArchitectureContractPassesForStructuredDocument(workspaceRoot);
    await testArchitectureContractFailsForMissingSections(workspaceRoot);
    await testArchitectureContractFailsForPlaceholderAndBoundaryIssues(workspaceRoot);
    await testArchitectureContractAcceptsFencedJsonLlmResult(workspaceRoot);
    await testArchitectureContractRejectsInvalidLlmResult(workspaceRoot);
    await testArchitectureContractLoadsTemplateContractSource();
    await testArchitectureContractBuildsPromptRequest(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testArchitectureContractPassesForStructuredDocument(workspaceRoot: string): Promise<void> {
  const architectureDocument = await loadArchitectureDocumentFixture();
  const contract = new ArchitectureDesignContract(new ArchitectureContractMockLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-1",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: architectureDocument,
      },
    },
  );

  assert.deepEqual(result, {
    passed: true,
    summary: "Architecture design document passed contract checks.",
    issues: [],
  });
}

async function testArchitectureContractFailsForMissingSections(workspaceRoot: string): Promise<void> {
  const contract = new ArchitectureDesignContract(new ArchitectureContractMockLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-2",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: "# 1. Purpose",
      },
    },
  );

  assert.equal(result.passed, false);
  assert.equal(result.summary, "Architecture design document failed contract checks.");
  assert.equal(
    result.issues.some((issue) => issue.message.includes("section 2") || issue.message.includes("Architecture Design")),
    true,
  );
}

async function testArchitectureContractFailsForPlaceholderAndBoundaryIssues(workspaceRoot: string): Promise<void> {
  const architectureDocument = await loadArchitectureDocumentFixture();
  const contract = new ArchitectureDesignContract(new ArchitectureContractMockLlmExecutor());
  const brokenDocument = architectureDocument
    .replace("- Workflow -> Contract", "- Workflow -> Database")
    .replace(/(#{2,3} 5\.2 Core Modules[\s\S]*?)(?=\n#{2,3} 5\.3 |\n#{2,3} 6\. |\n# 6\.|$)/, [
      "## 5.2 Core Modules",
      "- Interface/CLI: trigger workflow-related tasks through CLI.",
      "- Workflow/Pipeline: control workflow execution, stage state, stage entry, and retry.",
    ].join("\n"))
    .concat("\n\n## 9.1 {OpenIssue}\n\nBuild one class ArchitectureManager and one API endpoint /architecture.");

  const result = await contract.check(
    {
      taskId: "task-3",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: brokenDocument,
      },
    },
  );

  assert.equal(result.passed, false);
  assert.equal(
    result.issues.some((issue) => issue.message.includes("unresolved template placeholders")),
    true,
  );
  assert.equal(
    result.issues.some((issue) => issue.message.includes("implementation-level detail")),
    true,
  );
  assert.equal(
    result.issues.some((issue) => issue.message.includes("undefined layers or partitions")),
    true,
  );
  assert.equal(
    result.issues.some((issue) => issue.message.includes("Core Modules section should list the major modules")),
    true,
  );
}

async function testArchitectureContractRejectsInvalidLlmResult(workspaceRoot: string): Promise<void> {
  const architectureDocument = await loadArchitectureDocumentFixture();
  const contract = new ArchitectureDesignContract(new InvalidJsonLlmExecutor());

  await assert.rejects(
    contract.check(
      {
        taskId: "task-invalid",
        stageId: "architecture_design",
        attempt: 1,
        workspaceRoot,
        inputArtifacts: {},
      },
      {
        stageId: "architecture_design",
        success: true,
        summary: "Architecture document generated.",
        artifacts: {
          artifactKey: "architecture_document",
          content: architectureDocument,
        },
      },
    ),
    /Unexpected token|must contain/,
  );
}

async function testArchitectureContractAcceptsFencedJsonLlmResult(workspaceRoot: string): Promise<void> {
  const architectureDocument = await loadArchitectureDocumentFixture();
  const contract = new ArchitectureDesignContract(new FencedJsonLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-fenced",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: architectureDocument,
      },
    },
  );

  assert.equal(result.passed, true);
  assert.equal(result.summary, "Architecture design document passed contract checks.");
  assert.deepEqual(result.issues, []);
}

async function testArchitectureContractLoadsTemplateContractSource(): Promise<void> {
  const contract = new ArchitectureDesignContract();
  const spec = await (contract as unknown as {
    loadSpecificContract(): Promise<{
      document_contracts: Array<{ check_item: string }>;
      section_contracts: Array<{ section_id: string }>;
      specific_contract?: Record<string, unknown>;
    }>;
  }).loadSpecificContract();
  const rawSpec = JSON.parse(
    await readFile(
      path.resolve(
        process.cwd(),
        "..",
        "..",
        "..",
        "meta_layer",
        "resources",
        "contract",
        "TechnicalArchitectureTemplate.contract.json",
      ),
      "utf8",
    ),
  ) as { document_contracts: Array<{ check_item: string }> };

  assert.deepEqual(
    spec.document_contracts.map((entry) => entry.check_item),
    rawSpec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(
    spec.specific_contract?.source,
    "dist/resources/contract/TechnicalArchitectureTemplate.contract.json",
  );
  assert.equal(spec.specific_contract?.stage, "architecture_design");
}

async function testArchitectureContractBuildsPromptRequest(workspaceRoot: string): Promise<void> {
  const architectureDocument = await loadArchitectureDocumentFixture();
  const contract = new ArchitectureDesignContract();
  const spec = await (contract as unknown as {
    loadSpecificContract(): Promise<{
      document_contracts: Array<{ check_item: string }>;
      section_contracts: Array<{ section_id: string }>;
      specific_contract?: { source?: string; stage?: string };
    }>;
  }).loadSpecificContract();

  const request = await (contract as unknown as {
    buildCheckRequest(
      context: {
        taskId: string;
        stageId: string;
        attempt: number;
        workspaceRoot: string;
        inputArtifacts: Record<string, string>;
      },
      output: {
        stageId: string;
        success: boolean;
        summary: string;
        artifacts: { artifactKey: "architecture_document"; content: string };
      },
      contractSpec: unknown,
    ): Promise<{
      prompt: { systemPrompt: string; userPrompt: Record<string, string> };
      responseFormat: "json";
      metadata?: Record<string, string>;
    }>;
  }).buildCheckRequest(
    {
      taskId: "task-4",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: architectureDocument,
      },
    },
    spec,
  );

  const payload = JSON.parse(normalizeUserPromptContent(request.prompt.userPrompt)) as {
    target: string;
    generatedResult: string;
    contractSpec: typeof spec;
  };

  assert.equal(request.responseFormat, "json");
  assert.equal(request.metadata?.stage, "architecture_design");
  assert.equal(request.metadata?.checkType, "contract");
  assert.equal(normalizeUserPromptContent({ system: request.prompt.systemPrompt }).includes("Return JSON"), true);
  assert.equal(payload.target, "architecture_design_contract_check");
  assert.equal(payload.generatedResult.includes("# 1. Purpose"), true);
  assert.deepEqual(
    payload.contractSpec.document_contracts.map((entry) => entry.check_item),
    spec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(
    payload.contractSpec.specific_contract?.source,
    "dist/resources/contract/TechnicalArchitectureTemplate.contract.json",
  );
  assert.equal(payload.contractSpec.specific_contract?.stage, "architecture_design");
  assert.equal(payload.contractSpec.section_contracts.length, spec.section_contracts.length);
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

async function loadArchitectureDocumentFixture(): Promise<string> {
  return readFile(
    path.resolve(process.cwd(), "tests", "architecture", "fixtures", "valid-technical-architecture.md"),
    "utf8",
  );
}

class ArchitectureContractMockLlmExecutor implements ILlmExecutor {
  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    const payload = JSON.parse(normalizeUserPromptContent(request.prompt.userPrompt)) as {
      generatedResult: string;
      contractSpec: import("../../src/contract/document-stage-contract.js").ContractSpec;
    };
    const result = runArchitectureContractStyleChecks(payload.generatedResult, payload.contractSpec);

    return {
      content: JSON.stringify(result),
      responseFormat: "json",
    };
  }
}

class FencedJsonLlmExecutor implements ILlmExecutor {
  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: "```json\n{\"passed\":true,\"summary\":\"Architecture design document passed contract checks.\",\"issues\":[]}\n```",
      responseFormat: "json",
    };
  }
}

class InvalidJsonLlmExecutor implements ILlmExecutor {
  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: "{not-json",
      responseFormat: "json",
    };
  }
}
