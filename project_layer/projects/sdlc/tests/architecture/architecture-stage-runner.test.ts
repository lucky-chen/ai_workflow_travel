import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { ArtifactStoreService } from "../../src/data/artifact-store/artifact-store.js";
import { InMemoryChangeGate } from "../../src/quality-gate/change-gate/change-gate.js";
import { InMemoryTraceRecorder } from "../../src/quality-gate/trace/trace-recorder.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/sdk/llm-executor/llm-executor.js";
import { ArchitectureStageRunner } from "../../src/workflow/stage-runners/architecture-stage-runner.js";
import { resolveArchitectureArtifactPath } from "../../src/workflow/stage-runners/stage-artifact-paths.js";

export async function runArchitectureStageRunnerTests(): Promise<void> {
  const storageRoot = await createTempDir("architecture-stage-runner-");
  const workspaceRoot = await createTempDir("architecture-workspace-");
  const artifactStore = new ArtifactStoreService(storageRoot);

  try {
    await testArchitectureStageRunnerPersistsAcceptedDocument(artifactStore, workspaceRoot);
    await testArchitectureStageRunnerRejectStopsPersistence(artifactStore, workspaceRoot);
    await testArchitectureStageRunnerContractFailure(artifactStore, workspaceRoot);
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testArchitectureStageRunnerPersistsAcceptedDocument(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const traceRecorder = new InMemoryTraceRecorder();
  const changeGate = new InMemoryChangeGate();
  const content = createArchitectureDocument();
  const runner = new ArchitectureStageRunner({
    llmExecutor: new ArchitectureStageRunnerLlmExecutor(content),
    artifactStore,
    traceRecorder,
    changeGate,
  });

  const output = await runner.run({
    taskId: "task-1",
    stageId: "architecture_design",
    attempt: 1,
    workspaceRoot,
    inputArtifacts: {
      requirement_document: "# 1. Background\nRequirement baseline.",
    },
  });

  assert.equal(output.artifacts.architecture_document, resolveArchitectureArtifactPath(workspaceRoot));
  assert.equal(
    await artifactStore.getArtifact({
      taskId: "task-1",
      stageId: "architecture_design",
      filePath: resolveArchitectureArtifactPath(workspaceRoot),
    }),
    content,
  );
  assert.equal(
    await readFile(path.join(workspaceRoot, resolveArchitectureArtifactPath(workspaceRoot)), "utf8"),
    content,
  );
  assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
    "stage_started",
    "generation_started",
    "generation_finished",
    "contract_checked",
    "gate_reviewed",
    "artifact_persisted",
  ]);
}

async function testArchitectureStageRunnerRejectStopsPersistence(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ArchitectureStageRunner({
    llmExecutor: new ArchitectureStageRunnerLlmExecutor(createArchitectureDocument()),
    artifactStore,
    changeGate: new InMemoryChangeGate({
      decision: {
        action: "reject",
        summary: "Rejected in review.",
      },
    }),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-2",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: "# 1. Background\nRequirement baseline.",
      },
    }),
    /Change review ended with action "reject"\./,
  );

  await assert.rejects(
    artifactStore.getArtifact({
      taskId: "task-2",
      stageId: "architecture_design",
      filePath: resolveArchitectureArtifactPath(workspaceRoot),
    }),
  );
}

async function testArchitectureStageRunnerContractFailure(
  artifactStore: ArtifactStoreService,
  workspaceRoot: string,
): Promise<void> {
  const runner = new ArchitectureStageRunner({
    llmExecutor: new ArchitectureStageRunnerLlmExecutor("# 1. Purpose\nBroken output"),
    artifactStore,
    changeGate: new InMemoryChangeGate(),
  });

  await assert.rejects(
    runner.run({
      taskId: "task-3",
      stageId: "architecture_design",
      attempt: 1,
      workspaceRoot,
      inputArtifacts: {
        requirement_document: "# 1. Background\nRequirement baseline.",
      },
    }),
    /Architecture contract failed:/,
  );
}

async function createTempDir(prefix: string): Promise<string> {
  const tempRoot = path.resolve(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  return mkdtemp(path.join(tempRoot, prefix));
}

class ArchitectureStageRunnerLlmExecutor implements ILlmExecutor {
  constructor(private readonly content: string) {}

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    if (request.metadata?.checkType === "contract") {
      const passed = this.content.includes("## 4.2 Layers or Partitions");
      return {
        content: JSON.stringify({
          passed,
          summary: passed
            ? "Architecture design document passed contract checks."
            : "Architecture design document failed contract checks.",
          issues: passed ? [] : [
            {
              checkItem: "document_structure_complete",
              message: "Missing required architecture sections.",
              severity: "high",
            },
          ],
        }),
        responseFormat: "json",
      };
    }

    return {
      content: this.content,
      responseFormat: "text",
      metadata: {
        ...(request.metadata ?? {}),
      },
    };
  }
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
    "- Execution: generates stage artifacts.",
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
