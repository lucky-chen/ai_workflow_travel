import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkspaceCopy,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
} from "./hello-service-test-helpers.mjs";

const successTaskId = "hello-service-item-design-contract-success-task";
const runId = "4701-item-design-contract";

const validItemDesignDocument = `# Workflow Design

## 1. Goal

### 1.1 Purpose

Workflow keeps the hello-service item boundary explicit and stable.

### 1.2 Involved Modules

This module design directly involves:

- Workflow

This module design collaborates with:

- RequirementDesign
- WorkPlan

### 1.3 Core Functions

Workflow is the orchestration item for hello-service implementation details.

Its core functions are:

- define the generated source boundary
- expose the stable API
- document runtime interaction
- describe output structure

Workflow does not own requirement authoring, architecture authoring, or work-plan validation.

## 2. Core Classes

### 2.1 Class Diagram

\`\`\`plantuml
class WorkflowService
class HelloServiceResult
WorkflowService --> HelloServiceResult
\`\`\`

### 2.2 Core Class Responsibilities

#### 2.2.1 \`WorkflowService\`

Role:

- coordinate hello-service generation

Responsibilities:

- expose a stable hello API
- map runtime input into output
- keep output formatting predictable

## 3. Core Runtime Flow

### 3.1 Main Sequence Diagram

\`\`\`plantuml
actor Caller
participant WorkflowService
Caller -> WorkflowService: execute(input)
WorkflowService --> Caller: result
\`\`\`

## 4. Detailed Design

### 4.1 Core APIs And Types

#### 4.1.1 Public API

\`\`\`typescript
interface WorkflowApi {
  execute(input: WorkflowInput): WorkflowOutput
}
\`\`\`

#### 4.1.2 Input Types

\`\`\`typescript
interface WorkflowInput {
  name: string
}
\`\`\`

#### 4.1.4 Output Types

\`\`\`typescript
interface WorkflowOutput {
  message: string
}
\`\`\`

### 4.2 Constraints

- keep the API minimal
- keep output deterministic

### 4.6 Constraints

- keep the API minimal
- keep output deterministic
`;

export async function runHelloServiceItemDesignContractSuccessTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy();

  try {
    await resetWorkspace(targetWorkspaceRoot);

    const itemDesignDirectory = path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design");
    await mkdir(itemDesignDirectory, { recursive: true });
    await writeFile(path.join(itemDesignDirectory, "Workflow.md"), validItemDesignDocument, "utf8");

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", "sdlc/docs/item_design/Workflow.md"],
      { taskId: successTaskId, runId },
    );

    const traceRecords = await loadTraceRecords(targetWorkspaceRoot, runId);
    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "item_design_contract_result.json"),
    );

    assert.equal(contractResult.passed, true);
    assert.equal(
      traceRecords.some(
        (entry) =>
          entry.scope?.executionUnitId === "item_design_contract"
          && entry.category === "artifact"
          && entry.payload?.filePath === "item_design_contract_result.json",
      ),
      true,
    );
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceItemDesignContractSuccessTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
