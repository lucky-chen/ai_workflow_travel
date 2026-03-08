import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ModuleDesignContract } from "../src/contract/module-design-contract/module-design-contract.js";

export async function runModuleDesignContractTests(): Promise<void> {
  const workspaceRoot = await createTempDir("module-contract-");

  try {
    await testModuleDesignContractPassesForStructuredDocument(workspaceRoot);
    await testModuleDesignContractFailsForMissingSections(workspaceRoot);
    await testModuleDesignContractFailsForFormatAndConsistencyIssues(workspaceRoot);
    await testModuleDesignContractLoadsTemplateContractSource();
    await testModuleDesignContractBuildsPromptRequest(workspaceRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testModuleDesignContractPassesForStructuredDocument(workspaceRoot: string): Promise<void> {
  const contract = new ModuleDesignContract();
  const result = await contract.check(
    {
      taskId: "task-1",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "module_design",
      success: true,
      summary: "Module design document generated.",
      artifacts: {
        artifactKey: "module_design_document",
        moduleName: "Workflow",
        content: createModuleDesignDocument(),
      },
    },
  );

  assert.deepEqual(result, {
    passed: true,
    summary: "Module design document passed contract checks.",
    issues: [],
  });
}

async function testModuleDesignContractFailsForMissingSections(workspaceRoot: string): Promise<void> {
  const contract = new ModuleDesignContract();
  const result = await contract.check(
    {
      taskId: "task-2",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "module_design",
      success: true,
      summary: "Module design document generated.",
      artifacts: {
        artifactKey: "module_design_document",
        moduleName: "Workflow",
        content: "# Workflow Design",
      },
    },
  );

  assert.equal(result.passed, false);
  assert.equal(result.summary, "Module design document failed contract checks.");
  assert.equal(
    result.issues.some((issue) => issue.message.includes("Class Diagram") || issue.message.includes("Core Runtime Flow")),
    true,
  );
}

async function testModuleDesignContractFailsForFormatAndConsistencyIssues(workspaceRoot: string): Promise<void> {
  const contract = new ModuleDesignContract();
  const brokenDocument = createModuleDesignDocument()
    .replace("# Workflow Design", "# Wrong Design")
    .replace(
      "```ts\ninterface ModuleDesignInput {\n  architectureDocument: string\n  moduleDescriptor: ModuleDescriptor\n}\n```",
      "Input is architectureDocument plus moduleDescriptor.",
    )
    .replace(
      "```ts\ninterface ModuleDesignOutput {\n  artifactKey: \"module_design_document\"\n  moduleName: string\n  content: string\n}\n```",
      "Output is moduleName and generated markdown.",
    )
    .replace(
      "Role:\n\n- orchestrate workflow execution.\n\nResponsibilities:\n\n- coordinate stage transitions.\n- prepare stage runtime context.\n- hand off accepted artifacts downstream.",
      "Responsibilities only.",
    );

  const result = await contract.check(
    {
      taskId: "task-3",
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "module_design",
      success: true,
      summary: "Module design document generated.",
      artifacts: {
        artifactKey: "module_design_document",
        moduleName: "Workflow",
        content: brokenDocument,
      },
    },
  );

  assert.equal(result.passed, false);
  assert.equal(result.issues.some((issue) => issue.message.includes("prose outside code blocks")), true);
  assert.equal(result.issues.some((issue) => issue.message.includes("should match module name")), true);
  assert.equal(result.issues.some((issue) => issue.message.includes("Role and Responsibilities")), true);
}

async function testModuleDesignContractLoadsTemplateContractSource(): Promise<void> {
  const contract = new ModuleDesignContract();
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
        "ModuleDesignTemplate.contract.json",
      ),
      "utf8",
    ),
  ) as { document_contracts: Array<{ check_item: string }> };

  assert.deepEqual(
    spec.document_contracts.map((entry) => entry.check_item),
    rawSpec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(spec.specific_contract?.source, "meta_layer/resources/contract/ModuleDesignTemplate.contract.json");
  assert.equal(spec.specific_contract?.stage, "module_design");
}

async function testModuleDesignContractBuildsPromptRequest(workspaceRoot: string): Promise<void> {
  const contract = new ModuleDesignContract();
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
        artifacts: { artifactKey: "module_design_document"; moduleName: string; content: string };
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
      stageId: "module_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {},
    },
    {
      stageId: "module_design",
      success: true,
      summary: "Module design document generated.",
      artifacts: {
        artifactKey: "module_design_document",
        moduleName: "Workflow",
        content: createModuleDesignDocument(),
      },
    },
    spec,
  );

  const payload = JSON.parse(request.prompt.userPrompt) as {
    target: string;
    moduleName: string;
    generatedResult: string;
    contractSpec: {
      document_contracts: Array<{ check_item: string }>;
      section_contracts: Array<{ section_id: string }>;
      specific_contract?: { source?: string; stage?: string };
    };
  };

  assert.equal(request.responseFormat, "json");
  assert.equal(request.metadata?.stage, "module_design");
  assert.equal(request.metadata?.checkType, "contract");
  assert.equal(request.prompt.systemPrompt.includes("Return JSON"), true);
  assert.equal(payload.target, "module_design_contract_check");
  assert.equal(payload.moduleName, "Workflow");
  assert.equal(payload.generatedResult.includes("# Workflow Design"), true);
  assert.deepEqual(
    payload.contractSpec.document_contracts.map((entry) => entry.check_item),
    spec.document_contracts.map((entry) => entry.check_item),
  );
  assert.equal(payload.contractSpec.specific_contract?.source, "meta_layer/resources/contract/ModuleDesignTemplate.contract.json");
  assert.equal(payload.contractSpec.specific_contract?.stage, "module_design");
  assert.equal(payload.contractSpec.section_contracts.length, spec.section_contracts.length);
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

function createModuleDesignDocument(): string {
  return [
    "# Workflow Design",
    "",
    "## 1. Goal",
    "",
    "### 1.1 Purpose",
    "Define the workflow module boundary and stable orchestration APIs.",
    "",
    "### 1.2 Involved Modules",
    "This module design directly involves:",
    "",
    "- `Workflow/Pipeline`",
    "",
    "This module design collaborates with:",
    "",
    "- `Execution/RequirementGenerator`",
    "- `Contract/RequirementContract`",
    "",
    "### 1.3 Core Functions",
    "`Workflow/Pipeline` is the stage orchestration module.",
    "",
    "Its core functions are:",
    "",
    "- launch tasks",
    "- build stage runtime context",
    "- sequence stages",
    "- hand off accepted artifacts",
    "",
    "`Workflow` does not own prompt construction, contract rules, or artifact persistence internals.",
    "",
    "## 2. Core Classes",
    "",
    "### 2.1 Class Diagram",
    "```plantuml",
    "@startuml",
    "interface IPipeline",
    "class PipelineService",
    "class StageRegistry",
    "IPipeline <|.. PipelineService",
    "PipelineService --> StageRegistry",
    "@enduml",
    "```",
    "",
    "### 2.2 Core Class Responsibilities",
    "#### 2.2 `PipelineService`",
    "",
    "Role:",
    "",
    "- orchestrate workflow execution.",
    "",
    "Responsibilities:",
    "",
    "- coordinate stage transitions.",
    "- prepare stage runtime context.",
    "- hand off accepted artifacts downstream.",
    "",
    "## 3. Core Runtime Flow",
    "",
    "### 3.1 Main Sequence Diagram",
    "```plantuml",
    "@startuml",
    "participant User",
    "participant PipelineService",
    "participant StageRunner",
    "User -> PipelineService: launchTask()",
    "PipelineService -> StageRunner: run(context)",
    "StageRunner --> PipelineService: stageOutput",
    "@enduml",
    "```",
    "",
    "## 4. Detailed Design",
    "",
    "### 4.1 Core APIs And Fields",
    "",
    "#### 4.1.1 Public API",
    "```ts",
    "interface IPipeline {",
    "  launchTask(request: LaunchTaskRequest): Promise<string>",
    "}",
    "```",
    "",
    "#### 4.1.2 Input Types",
    "```ts",
    "interface ModuleDesignInput {",
    "  architectureDocument: string",
    "  moduleDescriptor: ModuleDescriptor",
    "}",
    "```",
    "",
    "#### 4.1.3 Runtime Types",
    "```ts",
    "interface StageRuntime {",
    "  stageId: string",
    "  nextStageId?: string",
    "}",
    "```",
    "",
    "#### 4.1.4 Output Types",
    "```ts",
    "interface ModuleDesignOutput {",
    "  artifactKey: \"module_design_document\"",
    "  moduleName: string",
    "  content: string",
    "}",
    "```",
    "",
    "#### 4.1.5 Module-Specific Rules",
    "- downstream handoff must preserve stable artifact keys",
    "- stage retry must reuse task identity",
    "- only accepted artifacts can flow to the next stage",
    "",
    "## 4.2 Constraints",
    "- keep workflow sequencing explicit",
    "- keep stage boundaries reviewable",
    "- keep runtime context minimal",
    "- avoid embedding module-internal execution logic here",
  ].join("\n");
}
