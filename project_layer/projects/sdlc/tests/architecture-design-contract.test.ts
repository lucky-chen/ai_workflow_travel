import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArchitectureDesignContract } from "../src/contract/architecture-design-contract/architecture-design-contract.js";

export async function runArchitectureDesignContractTests(): Promise<void> {
  const workspaceRoot = await createTempDir("architecture-contract-");

  try {
    await testArchitectureContractPassesForStructuredDocument(workspaceRoot);
    await testArchitectureContractFailsForMissingSections(workspaceRoot);
    await testArchitectureContractFailsForPlaceholderAndBoundaryIssues(workspaceRoot);
    await testArchitectureContractLoadsTemplateContractSource();
    await testArchitectureContractBuildsPromptRequest(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testArchitectureContractPassesForStructuredDocument(workspaceRoot: string): Promise<void> {
  const contract = new ArchitectureDesignContract();
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
        content: createArchitectureDocument(),
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
  const contract = new ArchitectureDesignContract();
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
  const contract = new ArchitectureDesignContract();
  const brokenDocument = createArchitectureDocument()
    .replace("- Workflow -> Contract", "- Workflow -> Database")
    .replace(
      "## 5.2 Core Modules\n- Interface Layer: handles CLI entry and user confirmation.\n- Workflow: orchestrates stage execution.\n- Execution: generates stage artifacts.\n- Contract: validates generated artifacts.\n- Quality Gate: manages review and trace.\n- Data: persists artifacts and history.",
      "## 5.2 Core Modules\n- Interface Layer: handles CLI entry and user confirmation.\n- Workflow: orchestrates stage execution.\n",
    )
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
    "meta_layer/resources/contract/TechnicalArchitectureTemplate.contract.json",
  );
  assert.equal(spec.specific_contract?.stage, "architecture_design");
}

async function testArchitectureContractBuildsPromptRequest(workspaceRoot: string): Promise<void> {
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
      prompt: { systemPrompt: string; userPrompt: string };
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
        content: createArchitectureDocument(),
      },
    },
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
  };

  assert.equal(request.responseFormat, "json");
  assert.equal(request.metadata?.stage, "architecture_design");
  assert.equal(request.metadata?.checkType, "contract");
  assert.equal(request.prompt.systemPrompt.includes("Return JSON"), true);
  assert.equal(payload.target, "architecture_design_contract_check");
  assert.equal(payload.generatedResult.includes("# 1. Purpose"), true);
  assert.deepEqual(
    payload.contractSpec.document_contracts.map((entry) => entry.check_item),
    spec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(
    payload.contractSpec.specific_contract?.source,
    "meta_layer/resources/contract/TechnicalArchitectureTemplate.contract.json",
  );
  assert.equal(payload.contractSpec.specific_contract?.stage, "architecture_design");
  assert.equal(payload.contractSpec.section_contracts.length, spec.section_contracts.length);
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

function createArchitectureDocument(): string {
  return [
    "# 1. Purpose",
    "Define the overall technical architecture of the AI SDLC platform.",
    "- Team members: provide a shared high-level baseline for the team.",
    "- Senior engineers: review architecture direction and boundaries.",
    "- Junior engineers: understand system and module structure for later design and implementation.",
    "",
    "# 2. Scope",
    "This document defines the overall architecture boundary of the platform.",
    "It does not define module internals or implementation details.",
    "## 2.1 In Scope",
    "- Overall workflow from requirement input to design generation, implementation generation, review, validation, and acceptance.",
    "- Major modules and their responsibilities at architecture level.",
    "- Collaboration boundaries and dependency direction between major parts of the system.",
    "## 2.2 Out of Scope",
    "- Detailed module internals and implementation logic.",
    "- Detailed API contracts, prompt content, and parameter definitions inside each module.",
    "- Database schema details and storage-level design.",
    "",
    "# 3. Design Drivers",
    "## 3.1 end-to-end workflow support",
    "The architecture must support the full flow from requirement input to design generation, implementation generation, review, validation, and acceptance.",
    "## 3.2 requirement interpretation as stable upstream input",
    "Requirement documents written in natural language must be checked and stabilized before they are used as downstream input.",
    "## 3.3 design doc interpretation as stable upstream input",
    "Design outputs generated in upstream stages must be checked and stabilized before they are used as downstream input.",
    "## 3.4 human-in-the-loop control",
    "Important changes must remain human-reviewable and require users to confirm.",
    "## 3.5 Validation visibility",
    "The system must provide validation or test feedback for generated outputs.",
    "## 3.6 evolution from CLI to UI",
    "The platform is CLI-only in the current scope and future evolution should preserve workflow separation.",
    "## 3.7 execution transparency and stage traceability",
    "Users need stage status and important changes to remain visible and traceable.",
    "## 3.8 incremental update on requirement changes",
    "Requirement changes are frequent, so the architecture should support downstream updates.",
    "## 3.9 Stage-level launch flexibility",
    "The architecture should support launching from a selected stage when required inputs are available.",
    "",
    "# 4. Architecture Design",
    "## 4.1 Architecture Style",
    "The system adopts a layered modular monolith architecture.",
    "## 4.2 Layers or Partitions",
    "- Interface Layer: handles CLI entry and user confirmation.",
    "- Workflow: orchestrates stage execution and handoff.",
    "- Execution: generates stage documents and code outputs.",
    "- Contract: checks generated artifacts against stage contracts.",
    "- Quality Gate: manages review, trace, and gate decisions.",
    "- Data: stores artifacts, history, and runtime state.",
    "## 4.3 Allowed Dependencies",
    "ALLOW:",
    "- Interface Layer -> Workflow",
    "- Workflow -> Execution",
    "- Workflow -> Contract",
    "- Workflow -> Quality Gate",
    "- Workflow -> Data",
    "- Execution -> Data",
    "- Contract -> Data",
    "- Quality Gate -> Data",
    "## 4.4 High-level Diagram",
    "```text",
    "[Interface Layer] -> [Workflow] -> [Execution]",
    "                         |            |",
    "                         v            v",
    "                    [Contract]   [Quality Gate]",
    "                         \\            /",
    "                          v          v",
    "                            [Data]",
    "```",
    "## 4.5 Runtime Topology",
    "- CLI Process: hosts interface, workflow, execution, contract, and quality-gate modules in one runtime.",
    "- Shared Storage: persists artifacts, history, and trace records.",
    "",
    "# 5. System Flow",
    "## 5.1 Main Flow",
    "```text",
    "[User] -> [Workflow] -> [Execution] -> [Contract] -> [Quality Gate] -> [Data]",
    "```",
    "1. User starts or resumes a stage.",
    "2. Workflow loads required upstream artifacts and invokes execution.",
    "3. Contract checks generated output and quality gate decides review outcome.",
    "The flow keeps generation, checking, review, and persistence explicit.",
    "## 5.2 Core Modules",
    "- Interface Layer: handles CLI entry and user confirmation.",
    "- Workflow: orchestrates stage execution.",
    "- Execution: generates stage artifacts.",
    "- Contract: validates generated artifacts.",
    "- Quality Gate: manages review and trace.",
    "- Data: persists artifacts and history.",
    "## 5.3 Interaction Model",
    "Modules collaborate through stage-oriented inputs, outputs, checks, and review decisions.",
    "### 5.3.1 Start Task",
    "Workflow creates runtime context and resolves stage entry.",
    "### 5.3.2 Generate Or Update Stage Artifact",
    "Execution produces or updates the stage artifact from upstream inputs.",
    "### 5.3.3 Check Stage Result",
    "Contract validates structure and stage boundaries.",
    "### 5.3.4 Review And Decision",
    "Quality Gate evaluates the change summary and returns a decision.",
    "### 5.3.5 Store Artifact And History",
    "Data modules persist accepted artifacts and task history.",
    "## 5.4 Key Considerations",
    "- keep stage boundaries explicit",
    "- keep downstream input stable after contract checks",
    "",
    "# 6. Non-Functional Considerations",
    "## 6.1 High Availability",
    "Current scope does not require distributed availability; correctness and reviewability are higher priority.",
    "## 6.2 High Scalability",
    "The architecture should keep module boundaries clear so background execution can evolve later.",
    "## 6.3 High Performance",
    "The architecture should preserve bounded stage work and visible progress instead of hiding long-running work.",
    "",
    "# 7. Design Documents",
    "## 7.1 Design Document Categories",
    "- Requirement document: stable product intent for downstream stages.",
    "- Architecture document: overall system structure and boundaries.",
    "- Module design document: module responsibilities and interfaces.",
    "- Implementation document: code-generation workplan and implementation result.",
    "## 7.2 Design Document Breakdown",
    "The workflow documents each recurring stage shape explicitly.",
    "### 7.2.1 Start Task",
    "Capture task entry, resume point, and required inputs.",
    "### 7.2.2 Generate Or Update Stage Artifact",
    "Describe how generation updates the stage artifact.",
    "### 7.2.3 Check Stage Result",
    "Describe contract checks and stabilization rules.",
    "### 7.2.4 Review And Decision",
    "Describe review inputs, gate semantics, and acceptance points.",
    "### 7.2.5 Store Artifact And History",
    "Describe persistence of accepted artifacts and task history.",
    "",
    "# 8. Open Issues",
    "- How validation workspaces should be isolated for implementation stages.",
    "- How UI evolution should expose the same stage trace semantics as the CLI.",
  ].join("\n");
}
