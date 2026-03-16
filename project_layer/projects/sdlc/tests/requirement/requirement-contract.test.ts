import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { RequirementContract } from "../../src/contract/requirement-contract.js";
import {
  normalizeUserPromptContent,
  type ILlmExecutor,
  type LlmExecutionRequest,
  type LlmExecutionResult,
} from "../../src/sdk/llm-executor/llm-executor.js";

export async function runRequirementContractTests(): Promise<void> {
  const workspaceRoot = await createTempDir("requirement-contract-");

  try {
    await testRequirementContractPassesForStructuredDocument(workspaceRoot);
    await testRequirementContractFailsForMissingSections(workspaceRoot);
    await testRequirementContractFailsForTemplatePlaceholdersAndImplementationDetail(workspaceRoot);
    await testRequirementContractAcceptsFencedJsonLlmResult(workspaceRoot);
    await testRequirementContractRejectsInvalidLlmResult(workspaceRoot);
    await testRequirementContractLoadsTemplateContractSource();
    await testRequirementContractBuildsPromptRequest(workspaceRoot);
    await testRequirementContractPrefersWorkspaceResourceSource(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRequirementContractPassesForStructuredDocument(workspaceRoot: string): Promise<void> {
  const contract = new RequirementContract(new RequirementContractMockLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-1",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "requirement_interpretation",
      success: true,
      summary: "Requirement document loaded.",
      artifacts: {
        artifactKey: "requirement_document",
        content: createRequirementDocument(),
      },
    },
  );

  assert.deepEqual(result, {
    passed: true,
    summary: "Requirement document passed contract checks.",
    issues: [],
  });
}

async function testRequirementContractFailsForMissingSections(workspaceRoot: string): Promise<void> {
  const contract = new RequirementContract(new RequirementContractMockLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-2",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "requirement_interpretation",
      success: true,
      summary: "Requirement document loaded.",
      artifacts: {
        artifactKey: "requirement_document",
        content: "# 1. Background",
      },
    },
  );

  assert.equal(result.passed, false);
  assert.equal(result.summary, "Requirement document failed contract checks.");
  assert.equal(
    result.issues.some((issue) => issue.message.includes("section 2") || issue.message.includes("User Scenarios")),
    true,
  );
}

async function testRequirementContractFailsForTemplatePlaceholdersAndImplementationDetail(
  workspaceRoot: string,
): Promise<void> {
  const contract = new RequirementContract(new RequirementContractMockLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-3",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "requirement_interpretation",
      success: true,
      summary: "Requirement document loaded.",
      artifacts: {
        artifactKey: "requirement_document",
        content: `${createRequirementDocument()}\n\n## 10.1 {ConstraintTitleA}\n\nBuild one class RequirementManager and one API endpoint /requirements.`,
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
}

async function testRequirementContractRejectsInvalidLlmResult(workspaceRoot: string): Promise<void> {
  const contract = new RequirementContract(new InvalidJsonLlmExecutor());

  await assert.rejects(
    contract.check(
      {
        taskId: "task-invalid",
        stageId: "requirement_interpretation",
        attempt: 1,
        workspaceRoot,
        inputArtifacts: {},
      },
      {
        stageId: "requirement_interpretation",
        success: true,
        summary: "Requirement document loaded.",
        artifacts: {
          artifactKey: "requirement_document",
          content: createRequirementDocument(),
        },
      },
    ),
    /Unexpected token|must contain/,
  );
}

async function testRequirementContractAcceptsFencedJsonLlmResult(workspaceRoot: string): Promise<void> {
  const contract = new RequirementContract(new FencedJsonLlmExecutor());
  const result = await contract.check(
    {
      taskId: "task-fenced",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "requirement_interpretation",
      success: true,
      summary: "Requirement document loaded.",
      artifacts: {
        artifactKey: "requirement_document",
        content: createRequirementDocument(),
      },
    },
  );

  assert.equal(result.passed, true);
  assert.equal(result.summary, "Requirement document passed contract checks.");
  assert.deepEqual(result.issues, []);
}

async function testRequirementContractLoadsTemplateContractSource(): Promise<void> {
  const contract = new RequirementContract();
  const spec = await (contract as unknown as {
    loadSpecificContract(): Promise<{
      document_contracts: Array<{ check_item: string }>;
      section_contracts: Array<{ section_id: string }>;
      specific_contract?: { source?: string; stage?: string };
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
        "RequirementTemplate.contract.json",
      ),
      "utf8",
    ),
  ) as { document_contracts: Array<{ check_item: string }> };

  assert.deepEqual(
    spec.document_contracts.map((entry) => entry.check_item),
    rawSpec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(spec.specific_contract?.source, "dist/resources/contract/RequirementTemplate.contract.json");
  assert.equal(spec.specific_contract?.stage, "requirement_interpretation");
}

async function testRequirementContractBuildsPromptRequest(workspaceRoot: string): Promise<void> {
  const contract = new RequirementContract();
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
        artifacts: { artifactKey: "requirement_document"; content: string };
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
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "requirement_interpretation",
      success: true,
      summary: "Requirement document loaded.",
      artifacts: {
        artifactKey: "requirement_document",
        content: createRequirementDocument(),
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
  assert.equal(request.metadata?.stage, "requirement_interpretation");
  assert.equal(request.metadata?.checkType, "contract");
  assert.equal(normalizeUserPromptContent({ system: request.prompt.systemPrompt }).includes("Return JSON"), true);
  assert.equal(payload.target, "requirement_contract_check");
  assert.equal(payload.generatedResult.includes("# 1. Background"), true);
  assert.deepEqual(
    payload.contractSpec.document_contracts.map((entry) => entry.check_item),
    spec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(payload.contractSpec.specific_contract?.source, "dist/resources/contract/RequirementTemplate.contract.json");
  assert.equal(payload.contractSpec.specific_contract?.stage, "requirement_interpretation");
  assert.equal(payload.contractSpec.section_contracts.length, spec.section_contracts.length);
}

async function testRequirementContractPrefersWorkspaceResourceSource(workspaceRoot: string): Promise<void> {
  const resourcePath = path.join(workspaceRoot, "sdlc", "resources", "contract", "RequirementTemplate.contract.json");
  await mkdir(path.dirname(resourcePath), { recursive: true });
  await writeFile(
    resourcePath,
    JSON.stringify({
      document_contracts: [{ check_item: "workspace_rule", description: "workspace", severity: "low" }],
      section_contracts: [],
    }),
    "utf8",
  );

  const contract = new RequirementContract();
  const spec = await (contract as unknown as {
    loadSpecificContract(context: { workspaceRoot: string }): Promise<{
      document_contracts: Array<{ check_item: string }>;
      specific_contract?: { source?: string; stage?: string };
    }>;
  }).loadSpecificContract({ workspaceRoot });

  assert.equal(spec.document_contracts[0]?.check_item, "workspace_rule");
  assert.equal(spec.specific_contract?.source, "workspace/sdlc/resources/contract/RequirementTemplate.contract.json");
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

function createRequirementDocument(): string {
  return [
    "# 1. Background",
    "- Users lose time coordinating requirement changes.",
    "- Product teams need a stable requirement baseline.",
    "- The platform should improve alignment before implementation.",
    "",
    "# 2. User Scenarios",
    "## 2.1 Technical Founders",
    "Validate product ideas quickly and get requirement artifacts that can drive downstream work.",
    "## 2.2 Indie Developers",
    "Need requirement documents explicit enough for downstream design and implementation.",
    "## 2.3 Small Product Teams (3-5 persons)",
    "Need shared understanding before architecture, item design, and work execution begin.",
    "",
    "# 3. Product Goals",
    "Deliver a stable requirement baseline for downstream stages.",
    "- Reduce ambiguity before architecture design starts.",
    "- Keep the document focused on product intent.",
    "- Make downstream handoff predictable.",
    "",
    "# 4. Core Problems and Product Abilities",
    "## 4.1 Requirements are not directly actionable",
    "- problem: teams interpret rough requests differently.",
    "- ability: the product structures requirement content into a stable template.",
    "## 4.2 The path from requirement to outputs is disconnected",
    "- problem: users must manually bridge multiple stages.",
    "- ability: the product provides independently runnable execution capabilities.",
    "## 4.3 Requirement changes are frequent and costly",
    "- problem: requirement changes force repeated manual updates.",
    "- ability: the product supports incremental updates of important artifacts.",
    "## 4.4 AI outputs are hard to trust",
    "- problem: users cannot see what the system is doing and whether changes are safe.",
    "- ability: the product shows execution process and pending changes before apply.",
    "## 4.5 Generated results are hard to evaluate",
    "- problem: users need a basic way to judge whether results are acceptable.",
    "- ability: the product provides validation feedback for quick assessment.",
    "",
    "# 5. Core Functional Points",
    "## 5.1 Basic Execution Units",
    "- [requirement_design_generate]: generate the requirement document from input and requirement context",
    "- [requirement_design_contract]: check the requirement document against requirement rules",
    "- [architecture_design_generate]: generate the architecture document from input and the requirement document",
    "- [item_design_generate]: generate a target item design document from input, the requirement document, and the architecture document",
    "- [work_plan_generate]: generate the work plan from input and upstream design documents",
    "- [work_execute]: execute the work plan from upstream design documents, work plan, and current workspace files",
    "- [work_execute_contract]: run one specific validation script in the work directory and return one work execute contract result json",
    "## 5.2 External Composition",
    "- [external_composition]: external callers can choose and combine basic execution units through the unified runtime entry",
    "## 5.3 Quality Control",
    "- [gate]: make allow or reject decisions only after contract or validation results are available",
    "- [trace]: record and expose execution status, important changes, and decision points during execution",
    "",
    "# 6. User Scenarios",
    "## 6.1 Standard Scenario",
    "### 6.1.1 Requirement Scenario",
    "- The user asks the system to generate the requirement document through [requirement_design_generate].",
    "- After the requirement document is generated, the system checks the requirement document through [requirement_design_contract].",
    "### 6.1.2 Architecture Scenario",
    "- The user asks the system to generate the architecture document through [architecture_design_generate].",
    "### 6.1.3 Item Design Scenario",
    "- The user asks the system to generate one target item design document through [item_design_generate].",
    "### 6.1.5 Planning Scenario",
    "- The user asks the system to generate the work plan through [work_plan_generate].",
    "### 6.1.6 Implementation Scenario",
    "- The user asks the system to execute the work plan through [work_execute].",
    "## 6.2 Scenario Failure Handling",
    "- If [work_execute_contract] fails, the related result must not continue downstream.",
    "",
    "# 7. Inputs and Outputs",
    "## 7.1 Basic Execution Units Inputs And Outputs",
    "### 7.1.1 [requirement_design_generate]",
    "- inputs:",
    "  - user_comment",
    "  - requirement_design_template.md",
    "- outputs:",
    "  - requirement_design.md",
    "### 7.1.15 [work_execute_contract]",
    "- inputs:",
    "  - user_comment",
    "  - work_dir",
    "- outputs:",
    "  - work_execute_contract_result.json",
    "## 7.2 External Composition Inputs And Outputs",
    "### 7.2.1 [external_composition]",
    "- inputs: one external composition request that selects one or more basic execution units and provides their required inputs",
    "- outputs: unified-entry calling constraints",
    "## 7.3 Quality Control Inputs And Outputs",
    "### 7.3.1 [gate]",
    "- inputs: contract result, validation result, or checked change set after the related contract or validation step",
    "- outputs: gate decision for downstream continuation or change application",
    "### 7.3.2 [trace]",
    "- inputs: execution status, important changes, and decision points during execution",
    "- outputs: trace records and trace summaries",
    "## 7.4 Prerequisites",
    "- have the ability to call an AI API",
    "",
    "# 8 Scope and Non-Goals",
    "## 8.1 V1: Internal",
    "- Goals",
    "  - complete the internal implementation of the Basic Execution Units capabilities",
    "- Non-Goals",
    "  - no external delivery target in this version",
    "## 8.2 V2: Internal",
    "- Goals",
    "  - complete the internal Quality Control capabilities",
    "- Non-Goals",
    "  - no external delivery target in this version",
    "## 8.3 V3: Current Product Goal",
    "- Goals",
    "  - deliver the current product goal around requirement, design, and execution flow",
    "- Non-Goals",
    "  - no all-in-one platform positioning in the current phase",
  ].join("\n");
}

class RequirementContractMockLlmExecutor implements ILlmExecutor {
  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    const payload = JSON.parse(normalizeUserPromptContent(request.prompt.userPrompt)) as {
      generatedResult: string;
      contractSpec: {
        document_contracts: Array<{ check_item: string; severity: "low" | "medium" | "high" }>;
        section_contracts: Array<{ section_id: string; title: string }>;
      };
    };

    const generatedResult = payload.generatedResult;
    const contractSpec = payload.contractSpec;
    const issues: Array<{ checkItem: string; message: string; severity: "low" | "medium" | "high" }> = [];

    if (generatedResult.length === 0) {
      issues.push({
        checkItem: "requirement_document_not_empty",
        message: "Requirement document content must not be empty.",
        severity: "high",
      });
    }

    for (const heading of [
      "# 1. Background",
      "# 2. User Scenarios",
      "# 3. Product Goals",
      "# 4. Core Problems and Product Abilities",
      "# 5. Core Functional Points",
      "# 6. User Scenarios",
      "# 7. Inputs and Outputs",
      "# 8 Scope and Non-Goals",
    ]) {
      if (!generatedResult.includes(heading)) {
        issues.push({
          checkItem: "document_structure_complete",
          message: `Missing required section: ${heading}`,
          severity: "high",
        });
      }
    }

    const scopeContract = contractSpec.document_contracts.find((entry) => entry.check_item === "requirement_scope_consistency");
    if (/{[^}]+}/.test(generatedResult)) {
      issues.push({
        checkItem: scopeContract?.check_item ?? "requirement_scope_consistency",
        message: "Requirement document still contains unresolved template placeholders.",
        severity: scopeContract?.severity ?? "high",
      });
    }
    if (/\bclass\s+\w+/i.test(generatedResult) || /\bAPI endpoint\b/i.test(generatedResult)) {
      issues.push({
        checkItem: scopeContract?.check_item ?? "requirement_scope_consistency",
        message: "Requirement document appears to contain implementation-level detail.",
        severity: scopeContract?.severity ?? "high",
      });
    }

    const alignmentContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "workflow_and_goal_alignment" || entry.check_item === "journey_and_goal_alignment",
    );
    if (!generatedResult.includes("# 3. Product Goals") || !/^\s*-\s+/m.test(extractSection(generatedResult, "# 3. Product Goals"))) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Product Goals section should include concrete goal items.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!extractSection(generatedResult, "# 4. Core Problems and Product Abilities").includes("problem:")
      || !extractSection(generatedResult, "# 4. Core Problems and Product Abilities").includes("ability:")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Core Problems and Product Abilities section should contain problem and ability pairs.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    if (!extractSection(generatedResult, "# 5. Core Functional Points").includes("[requirement_design_generate]")
      || !extractSection(generatedResult, "# 5. Core Functional Points").includes("[work_execute_contract]")) {
      issues.push({
        checkItem: alignmentContract?.check_item ?? "workflow_and_goal_alignment",
        message: "Core Functional Points section should define the canonical functional point names.",
        severity: alignmentContract?.severity ?? "high",
      });
    }

    return {
      content: JSON.stringify({
        passed: issues.length === 0,
        summary: issues.length === 0
          ? "Requirement document passed contract checks."
          : "Requirement document failed contract checks.",
        issues,
      }),
      responseFormat: "json",
    };
  }
}

class FencedJsonLlmExecutor implements ILlmExecutor {
  async execute(_request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return {
      content: "```json\n{\"passed\":true,\"summary\":\"Requirement document passed contract checks.\",\"issues\":[]}\n```",
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

function extractSection(content: string, heading: string): string {
  const startIndex = content.indexOf(heading);
  if (startIndex < 0) {
    return "";
  }

  const rest = content.slice(startIndex + heading.length);
  const nextHeadingOffset = rest.search(/\n# /);
  if (nextHeadingOffset < 0) {
    return rest;
  }

  return rest.slice(0, nextHeadingOffset);
}
