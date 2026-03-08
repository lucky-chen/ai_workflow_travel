import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ImplementationPlanContract } from "../../src/contract/implementation-plan-contract/implementation-plan-contract.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";

export async function runImplementationPlanContractTests(): Promise<void> {
  const workspaceRoot = await createTempDir("implementation-plan-contract-");

  try {
    await testImplementationPlanContractPassesForStructuredWorkplan(workspaceRoot);
    await testImplementationPlanContractFailsForMissingSections(workspaceRoot);
    await testImplementationPlanContractFailsForBrokenStepStructure(workspaceRoot);
    await testImplementationPlanContractRejectsInvalidLlmResult(workspaceRoot);
    await testImplementationPlanContractLoadsTemplateContractSource();
    await testImplementationPlanContractBuildsPromptRequest(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testImplementationPlanContractPassesForStructuredWorkplan(workspaceRoot: string): Promise<void> {
  const contract = new ImplementationPlanContract(new ImplementationPlanContractMockLlmExecutor());
  const result = await contract.check(
    createContext(workspaceRoot),
    createOutput(createImplementationPlanDocument()),
  );

  assert.deepEqual(result, {
    passed: true,
    summary: "Implementation workplan passed contract checks.",
    issues: [],
  });
}

async function testImplementationPlanContractFailsForMissingSections(workspaceRoot: string): Promise<void> {
  const contract = new ImplementationPlanContract(new ImplementationPlanContractMockLlmExecutor());
  const result = await contract.check(
    createContext(workspaceRoot),
    createOutput("# Code Generation Execution Plan"),
  );

  assert.equal(result.passed, false);
  assert.equal(result.summary, "Implementation workplan failed contract checks.");
  assert.equal(
    result.issues.some((issue) => issue.message.includes("Missing required section")),
    true,
  );
}

async function testImplementationPlanContractFailsForBrokenStepStructure(workspaceRoot: string): Promise<void> {
  const contract = new ImplementationPlanContract(new ImplementationPlanContractMockLlmExecutor());
  const brokenDocument = createImplementationPlanDocument()
    .replace("### Step 1. Deliver Shared Workflow Backbone", "### Workflow Backbone")
    .replace("Architecture modules in scope", "Modules")
    .replace("- [x] Batch 1: interfaces and skeleton", "- [x] Work chunk: interfaces and skeleton");

  const result = await contract.check(
    createContext(workspaceRoot),
    createOutput(brokenDocument),
  );

  assert.equal(result.passed, false);
  assert.equal(
    result.issues.some((issue) => issue.message.includes("step-oriented subsections")),
    true,
  );
  assert.equal(
    result.issues.some((issue) => issue.message.includes("Architecture modules in scope")),
    true,
  );
  assert.equal(
    result.issues.some((issue) => issue.message.includes("batch-oriented delivery items")),
    true,
  );
}

async function testImplementationPlanContractRejectsInvalidLlmResult(workspaceRoot: string): Promise<void> {
  const contract = new ImplementationPlanContract(new InvalidJsonLlmExecutor());

  await assert.rejects(
    contract.check(
      createContext(workspaceRoot),
      createOutput(createImplementationPlanDocument()),
    ),
    /Unexpected token|must contain/,
  );
}

async function testImplementationPlanContractLoadsTemplateContractSource(): Promise<void> {
  const contract = new ImplementationPlanContract();
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
        "CodeGenerationExecutionPlanTemplate.contract.json",
      ),
      "utf8",
    ),
  ) as { document_contracts: Array<{ check_item: string }> };

  assert.deepEqual(
    spec.document_contracts.map((entry) => entry.check_item),
    rawSpec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(spec.specific_contract?.source, "meta_layer/resources/contract/CodeGenerationExecutionPlanTemplate.contract.json");
  assert.equal(spec.specific_contract?.stage, "implementation_plan");
}

async function testImplementationPlanContractBuildsPromptRequest(workspaceRoot: string): Promise<void> {
  const contract = new ImplementationPlanContract();
  const spec = await (contract as unknown as {
    loadSpecificContract(): Promise<{
      document_contracts: Array<{ check_item: string }>;
      section_contracts: Array<{ section_id: string }>;
      specific_contract?: { source?: string; stage?: string };
    }>;
  }).loadSpecificContract();

  const request = await (contract as unknown as {
    buildCheckRequest(
      context: ReturnType<typeof createContext>,
      output: ReturnType<typeof createOutput>,
      contractSpec: unknown,
    ): Promise<{
      prompt: { systemPrompt: string; userPrompt: string };
      responseFormat: "json";
      metadata?: Record<string, string>;
    }>;
  }).buildCheckRequest(
    createContext(workspaceRoot),
    createOutput(createImplementationPlanDocument()),
    spec,
  );

  const payload = JSON.parse(request.prompt.userPrompt) as {
    target: string;
    generatedResult: string;
    contractSpec: {
      document_contracts: Array<{ check_item: string }>;
      section_contracts: Array<{ section_id: string }>;
      specific_contract?: { source?: string; stage?: string };
    };
    upstreamContext: {
      requirement_document: string;
      architecture_document: string;
      module_design_documents: string[];
    };
  };

  assert.equal(request.responseFormat, "json");
  assert.equal(request.metadata?.stage, "implementation_plan");
  assert.equal(request.metadata?.checkType, "contract");
  assert.equal(request.prompt.systemPrompt.includes("Return JSON"), true);
  assert.equal(payload.target, "implementation_plan_contract_check");
  assert.equal(payload.generatedResult.includes("# Code Generation Execution Plan"), true);
  assert.equal(payload.upstreamContext.requirement_document, "docs/requirements/Requirement.md");
  assert.equal(payload.upstreamContext.architecture_document, "docs/architecture/TechnicalArchitecture.md");
  assert.deepEqual(payload.upstreamContext.module_design_documents, [
    "docs/module_design/Workflow.md",
    "docs/module_design/Data.md",
  ]);
}

function createContext(workspaceRoot: string) {
  return {
    taskId: "task-1",
    stageId: "implementation_plan",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "docs/requirements/Requirement.md",
      architecture_document: "docs/architecture/TechnicalArchitecture.md",
      module_design_documents: JSON.stringify([
        "docs/module_design/Workflow.md",
        "docs/module_design/Data.md",
      ]),
    },
  };
}

function createOutput(content: string) {
  return {
    stageId: "implementation_plan",
    success: true,
    summary: "Implementation workplan generated.",
    artifacts: {
      artifactKey: "implementation_workplan" as const,
      content,
    },
  };
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class ImplementationPlanContractMockLlmExecutor implements ILlmExecutor {
  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    const payload = JSON.parse(request.prompt.userPrompt) as {
      generatedResult: string;
      contractSpec: {
        document_contracts: Array<{ check_item: string; severity: "low" | "medium" | "high" }>;
      };
    };
    const content = payload.generatedResult;
    const contractSpec = payload.contractSpec;
    const issues: Array<{ checkItem: string; message: string; severity: "low" | "medium" | "high" }> = [];

    const structureContract = contractSpec.document_contracts.find((entry) => entry.check_item === "document_structure_complete");
    for (const heading of ["## 1. Purpose", "## 1.1 Collaboration Rule", "## 2. Workflow Delivery Order", "## 3. Execution Steps"]) {
      if (!content.includes(heading)) {
        issues.push({
          checkItem: structureContract?.check_item ?? "document_structure_complete",
          message: `Missing required section: ${heading}`,
          severity: structureContract?.severity ?? "high",
        });
      }
    }

    const workflowContract = contractSpec.document_contracts.find((entry) => entry.check_item === "workflow_order_consistency");
    if (!/^\s*1\.\s+/m.test(content) || !/^\s*2\.\s+/m.test(content)) {
      issues.push({
        checkItem: workflowContract?.check_item ?? "workflow_order_consistency",
        message: "Workflow Delivery Order should contain an ordered numbered list.",
        severity: workflowContract?.severity ?? "high",
      });
    }

    const executionContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "execution_step_structure_consistency",
    );
    if (!/### Step \d+\./.test(content)) {
      issues.push({
        checkItem: executionContract?.check_item ?? "execution_step_structure_consistency",
        message: "Execution Steps should contain step-oriented subsections.",
        severity: executionContract?.severity ?? "high",
      });
    }
    if (!content.includes("Architecture modules in scope")) {
      issues.push({
        checkItem: executionContract?.check_item ?? "execution_step_structure_consistency",
        message: "Each step should include an Architecture modules in scope section.",
        severity: executionContract?.severity ?? "high",
      });
    }
    if (!/Batch 1:/m.test(content)) {
      issues.push({
        checkItem: executionContract?.check_item ?? "execution_step_structure_consistency",
        message: "Each step should include batch-oriented delivery items.",
        severity: executionContract?.severity ?? "high",
      });
    }

    return {
      content: JSON.stringify({
        passed: issues.length === 0,
        summary: issues.length === 0
          ? "Implementation workplan passed contract checks."
          : "Implementation workplan failed contract checks.",
        issues,
      }),
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

function createImplementationPlanDocument(): string {
  return [
    "# Code Generation Execution Plan",
    "",
    "## 1. Purpose",
    "Build project_layer from zero to a complete workflow.",
    "",
    "## 1.1 Collaboration Rule",
    "All implementation work under this plan must follow the shared collaboration standard:",
    "",
    "- `project_layer/docs/COLLABORATION_STANDARD.md`",
    "",
    "## 2. Workflow Delivery Order",
    "1. shared workflow backbone",
    "2. requirement_interpretation stage",
    "3. architecture_design stage",
    "4. module_design stage",
    "",
    "## 3. Execution Steps",
    "### Step 1. Deliver Shared Workflow Backbone",
    "- [x] Step 1 is partially completed",
    "- [x] Architecture modules in scope",
    "  - [x] `Workflow/Pipeline`",
    "- [x] Batch 1: interfaces and skeleton",
    "  - [x] shared contracts",
  ].join("\n");
}
