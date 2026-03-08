import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { RequirementContract } from "../src/contract/requirement-contract/requirement-contract.js";

export async function runRequirementContractTests(): Promise<void> {
  await testRequirementContractPassesForStructuredDocument();
  await testRequirementContractFailsForMissingSections();
  await testRequirementContractFailsForTemplatePlaceholdersAndImplementationDetail();
  await testRequirementContractLoadsTemplateContractSource();
}

async function testRequirementContractPassesForStructuredDocument(): Promise<void> {
  const contract = new RequirementContract();
  const result = await contract.check(
    {
      taskId: "task-1",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot: "/workspace/demo",
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

async function testRequirementContractFailsForMissingSections(): Promise<void> {
  const contract = new RequirementContract();
  const result = await contract.check(
    {
      taskId: "task-2",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot: "/workspace/demo",
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

async function testRequirementContractFailsForTemplatePlaceholdersAndImplementationDetail(): Promise<void> {
  const contract = new RequirementContract();
  const result = await contract.check(
    {
      taskId: "task-3",
      stageId: "requirement_interpretation",
      attempt: 1,
      workspaceRoot: "/workspace/demo",
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

async function testRequirementContractLoadsTemplateContractSource(): Promise<void> {
  const contract = new RequirementContract();
  const spec = await (contract as unknown as {
    loadSpecificContract(): Promise<{ document_contracts: Array<{ check_item: string }> }>;
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
}

function createRequirementDocument(): string {
  return [
    "# 1. Background",
    "- Users lose time coordinating requirement changes.",
    "- Product teams need a stable requirement baseline.",
    "- The platform should improve alignment before implementation.",
    "",
    "# 2. User Scenarios",
    "## 2.1 Product Managers",
    "Need to turn rough product requests into stable requirement documents.",
    "## 2.2 Engineers",
    "Need requirement documents that are explicit enough for downstream design.",
    "## 2.3 Delivery Team",
    "Need shared understanding before architecture and module design begin.",
    "",
    "# 3. Product Goals",
    "Deliver a stable requirement baseline for downstream stages.",
    "- Reduce ambiguity before architecture design starts.",
    "- Keep the document focused on product intent.",
    "- Make downstream handoff predictable.",
    "",
    "# 4. Core Problems and Product Abilities",
    "## 4.1 Requirement ambiguity",
    "- problem: teams interpret rough requests differently.",
    "- ability: the product structures requirement content into a stable template.",
    "",
    "# 5. User Workflow",
    "## 5.1 Standard Flow",
    "### 5.1.1 Draft input",
    "User provides initial requirement context.",
    "### 5.1.2 Requirement normalization",
    "System organizes the requirement into the standard document.",
    "## 5.2 Resume Support Entry Points",
    "- confirmed requirement draft",
    "  resume when the requirement is already reviewed.",
    "## 5.3 Failure Handling",
    "- request clarification when key requirement context is missing.",
    "",
    "# 6. Inputs and Outputs",
    "## 6.1 Inputs",
    "- raw requirement input",
    "## 6.2 Prerequisites",
    "- confirmed product context",
    "## 6.3 Outputs",
    "- requirement document for downstream stages",
    "",
    "# 7 Scope and Non-Goals",
    "## 7.1 V1: MVP",
    "- normalize requirement content and support review.",
    "## 7.2 V2: Available",
    "- compare revisions and support incremental updates.",
    "## 7.3 V3: General",
    "- broaden support for more product workflows.",
    "",
    "# 8. Success Criteria",
    "## 8.1 V1",
    "- requirement document passes contract review.",
    "## 8.2 V2",
    "- downstream architecture generation needs fewer manual fixes.",
    "## 8.3 V3",
    "- teams adopt the workflow consistently.",
    "",
    "# 9. Risks",
    "- users may provide underspecified requests.",
    "",
    "# 10. Constraints",
    "## 10.1 Timeline",
    "- review points must remain explicit.",
  ].join("\n");
}
