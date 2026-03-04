# Technical Architecture

## 1. Purpose

<!-- TEMPLATE_GUIDANCE_START
Writing Hints:
- State the purpose of this document in one short sentence.
- List the main readers and why they should read it.
- Keep the content at overall architecture level.
TEMPLATE_GUIDANCE_END -->

Define the overall technical architecture of the AI-RD platform.

- Team members: provide a shared high-level baseline for the team.
- Senior engineers: review architecture direction and boundaries.
- Junior engineers: understand system and module structure for later design and implementation.


## 2. Scope

<!-- TEMPLATE_GUIDANCE_START
Goal:
Define the boundary of the architecture so the document stays focused and does not expand into detailed implementation prematurely.

Writing Hints:
- Define what this document covers.
- Define what this document does not cover.
- Clarify the boundary between overall architecture and module design.
TEMPLATE_GUIDANCE_END -->

### 2.1 In Scope
- Overall workflow from requirement input to design generation, implementation generation, review, validation, and acceptance.
- Major modules and their responsibilities at architecture level.
- Collaboration boundaries and dependency direction between major parts of the system.
- Key architecture constraints related to reviewability, controllability, validation, and evolution.

### 2.2 Out of Scope
- Detailed module internals and implementation logic.
- Detailed API contracts, prompt content, and parameter definitions inside each module.
- Database schema details and storage-level design.
- UI-level interaction design and visual behavior details.
- Deployment runbooks, environment setup, and operational procedures.

Cross-module interaction contracts are covered at a lightweight shared-boundary level in a separate design document, not in full module-level detail here.

---

## 3. Design Drivers

<!-- TEMPLATE_GUIDANCE_START
Goal:
Capture the major drivers that materially shape the architecture and justify the core design choices.

Writing Hints:
- Focus only on drivers that affect architecture decisions.
- Include both functional and non-functional drivers where relevant.
- Avoid generic statements that do not influence structure.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
- [Functional driver]
- [Non-functional driver]
- [Operational or delivery constraint]
- [Governance or control requirement]
- [Important assumption that shapes the design]
TEMPLATE_PLACEHOLDER_END -->

---

### 3.1 end-to-end workflow support
The architecture must support the full flow from requirement input to design generation, implementation generation, review, validation, and acceptance.

### 3.2 requirement interpretation as stable upstream input
Requirement documents written in natural language must be checked and stabilized before they are used as downstream input. So the architecture needs requirement interpretation and contract-based checks to make requirement outputs become stable input for the next stage.

### 3.3 design doc interpretation as stable upstream input

Design outputs generated in upstream stages must be checked and stabilized before they are used as downstream input. So the architecture needs contract-based checks and gate decisions to make architecture design outputs and module design outputs become stable input for the next stage.

### 3.4 human-in-the-loop control
Important changes must remain human-reviewable and require users to confirm. So the architecture needs explicit review and apply points.

### 3.5 Validation visibility
The system must provide validation or test feedback for generated outputs, so validation needs to be a first-class part of the workflow

### 3.6 evolution from CLI to UI
The platform is CLI-only in the current scope. Future interface evolution should not break the separation between workflow logic and interface-specific logic.

### 3.7 execution transparency and stage traceability
Users need to understand what the platform is doing at each stage, so the architecture should make execution process, stage status, and important changes visible and traceable.

### 3.8 incremental update on requirement changes
Requirement changes are frequent, so the architecture should support comparing changes between different versions and generating downstream updates.

### 3.9 Stage-level launch flexibility
The architecture should support launching from a selected stage when the required inputs are available, so users can start from an intermediate stage without rerunning the whole workflow.

# 4. Architecture Design

<!-- TEMPLATE_GUIDANCE_START
Goal:
Describe the overall architecture of the system, including its high-level structure, design style, and dependency boundaries.

Writing Hints:
- Start from the overall architectural approach.
- Describe how the system is partitioned or layered.
- Explain dependency direction and structural constraints.
- Include one high-level diagram.
TEMPLATE_GUIDANCE_END -->


### 4.1 Architecture Style
<!-- TEMPLATE_PLACEHOLDER: [Describe the overall architectural style, such as layered, event-driven, modular monolith, service-oriented, or hybrid.] -->

The system adopts a layered modular architecture 

### 4.2 Layers or Partitions
<!-- TEMPLATE_PLACEHOLDER_START
- [Layer / Partition 1]: [Responsibility]
- [Layer / Partition 2]: [Responsibility]
- [Layer / Partition 3]: [Responsibility]
TEMPLATE_PLACEHOLDER_END -->

- Interface: system entry and information display, for example CLI and UI.
- Workflow: control process, state/context, stage entry, and retry
- Execution: stage execution capabilities, for example requirement interpretation, design generation, implementation generation, and validation.
- Contract: check whether stage inputs and outputs meet required structure and rules, and return issues and check results.
- QualityGate: manage review, reject, and apply decisions for pending changes, and decide whether results are allowed to pass to the next stage based on returned check results.
- Data: store shared data such as intermediate outputs from Execution and process records from QualityGate.

### 4.3 Allowed Dependencies
<!-- TEMPLATE_GUIDANCE_START
Writing Hints:
- Define dependency rules by allowed relations only.
- Treat all unspecified dependencies as forbidden by default.
- Keep the rules aligned with the layers or partitions defined above.
TEMPLATE_GUIDANCE_END -->

ALLOW:
- Interface -> Workflow
- Workflow -> Execution
- Workflow -> Contract
- Workflow -> QualityGate
- QualityGate -> Data
- Execution -> Data

### 4.4 High-level Diagram
```text
+------------------+
|    Interface     |
|       CLI        |
+------------------+
          |
          v
+------------------+
| Workflow         |
| process/state/   |
| context/stage    |
+------------------+
    /    |    \
   v     v     v
+----------+  +-------------------------+  +-------------+
| Execution|  |        Contract         |  | QualityGate |
| interpret|  |   structure rules       |  | review/apply|
| generate |  +-------------------------+  | decision    |
| validate |                             +-------------+
+----------+                                   |
     |                                         v
     +-----------------------------------> +----------+
                                          |   Data   |
                                          | shared   |
                                          | storage  |
                                          +----------+
```

### 4.5 Runtime Topology
<!-- TEMPLATE_GUIDANCE_START
Writing Hints:
- Describe the backend runtime and deployment view in a lightweight way.
- Clarify which major parts run together, which parts may be separated, and how shared storage is used.
- Keep the content at runtime topology level rather than deployment runbook detail.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
- [Runtime node or service]: [Responsibility]
- [Runtime node or service]: [Responsibility]
- [Shared storage or infrastructure]: [Responsibility]
TEMPLATE_PLACEHOLDER_END -->

- Interface/CLI: runtime entry for workflow requests in the current scope.
- Workflow/Pipeline, Contract/*, QualityGate/*: run in the core backend service in V1.
- Execution/*: run in the core backend service in V1; they can be split into workers later.
- Data/HistoryStore and Data/ArtifactStore: shared storage, implemented by local, backend-managed, or cloud storage.

---

## 5. System Flow

<!-- TEMPLATE_GUIDANCE_START
Goal:
Explain the key system-level flow, module interactions, and control points that shape runtime behavior.

Writing Hints:
- Describe only the runtime interactions needed to understand the system flow.
- Focus on module collaboration, main flow, and control points rather than module internals.
- Make the main execution or request path explicit.
- Identify review, approval, validation, stage entry, retry, or control points where relevant.
TEMPLATE_GUIDANCE_END -->

### 5.1 Main Flow
<!-- TEMPLATE_PLACEHOLDER_START
- [Module A]: [High-level responsibility]
- [Module B]: [High-level responsibility]
- [Module C]: [High-level responsibility]
- [Module D]: [High-level responsibility]
TEMPLATE_PLACEHOLDER_END -->
```text
Interface/CLI
      |
      v
Workflow/Pipeline
            |
            v
   [ StagePipeline for one stage ]
            |
            +--> load source / upstream artifacts
            +--> Execution/* generates staged artifact
            +--> Contract/* checks staged artifact
            +--> QualityGate/* reviews stage result
            +--> Data/* stores artifact and history
            |
            v
 next stage / stop / retry / wait review
```

1. Interface/CLI starts a workflow task and sends the request to Workflow/Pipeline.
2. Workflow/Pipeline runs one `StagePipeline` for the current stage.
3. Inside the stage pipeline, the system loads source input or confirmed upstream artifacts, then calls the corresponding `Execution/*` module to generate or update the stage artifact.
4. The generated result is checked by the corresponding `Contract/*` module and then submitted to `QualityGate/*` for review and decision.
5. During the stage flow, artifact results and workflow history are stored through the Data layer.
6. After the stage finishes, Workflow/Pipeline decides whether to continue to the next stage, stop, retry, or wait for user action.
7. The same main flow pattern is reused across requirement interpretation, design generation, implementation generation, and validation stages.

Each stage follows the same control shape: load source or upstream artifacts, generate or update the stage artifact, check the result, review the result, and store the accepted output.

### 5.2 Core Modules
<!-- TEMPLATE_PLACEHOLDER_START
- [Module A]: [High-level responsibility]
- [Module B]: [High-level responsibility]
- [Module C]: [High-level responsibility]
- [Module D]: [High-level responsibility]
TEMPLATE_PLACEHOLDER_END -->


- Interface/CLI: trigger workflow-related tasks through CLI.
- Workflow/Pipeline: control workflow execution, stage state, stage entry, and retry.
- Execution/RequirementInterpreter: turn raw requirement documents into structured and stable upstream input.
- Contract/RequirementContract: check whether requirement-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ArchitectureDesignGenerator: generate architecture design documents from upstream stable input.
- Contract/ArchitectureDesignContract: check whether architecture-design-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ModuleDesignGenerator: generate module design documents from upstream stable architecture design input.
- Contract/ModuleDesignContract: check whether module-design-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ImplementationGenerator: generate code and test artifacts from upstream module design outputs.
- Contract/ImplementationContract: check whether implementation-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ValidationRunner: run validation and produce validation results for generated outputs.
- QualityGate/Trace: provide visible review status, pending changes, and important progress information.
- QualityGate/ChangeGate: manage review, reject, and apply decisions based on contracts and required checks.
- Data/HistoryStore: store workflow history and operation records.
- Data/ArtifactStore: store raw files and generated artifacts, such as documents and resources.


### 5.3 Interaction Model
<!-- TEMPLATE_PLACEHOLDER: [Explain how the modules collaborate at a high level.] -->

This section describes workflow-level module interaction. The concrete public APIs for these cross-module calls are defined in `design_docs/CrossModuleApiContracts.md`.

#### 5.3.1 Start Task

- Interface/CLI -> Workflow/Pipeline: start workflow task

#### 5.3.2 Generate Or Update Stage Artifact

- Workflow/Pipeline -> Execution/RequirementInterpreter: interpret raw requirement input
- Workflow/Pipeline -> Execution/ArchitectureDesignGenerator: generate architecture design output
- Workflow/Pipeline -> Execution/ModuleDesignGenerator: generate module design output
- Workflow/Pipeline -> Execution/ImplementationGenerator: generate intermediate resources, for example code, test cases, and config
- Workflow/Pipeline -> Execution/ValidationRunner: run validation

#### 5.3.3 Check Stage Result

- Workflow/Pipeline -> Contract/RequirementContract: check requirement-stage input/output, report issues, and return the result for next-step decision
- Workflow/Pipeline -> Contract/ArchitectureDesignContract: check architecture-design-stage input/output, report issues, and return the result for the next-step decision
- Workflow/Pipeline -> Contract/ModuleDesignContract: check module-design-stage input/output, report issues, and return the result for the next-step decision
- Workflow/Pipeline -> Contract/ImplementationContract: check implementation-stage input/output, report issues, and return the result for the next-step decision

#### 5.3.4 Review And Decision

- Workflow/Pipeline -> QualityGate/ChangeGate: submit stage results together with contract check results for review, reject, or apply decisions

#### 5.3.5 Store Artifact And History

- Workflow/Pipeline -> QualityGate/Trace: notify important process information
- QualityGate/Trace -> Data/HistoryStore: save important process information
- Execution/* -> Data/ArtifactStore: save generated artifacts

### 5.4 Key Considerations
<!-- TEMPLATE_PLACEHOLDER_START
- [Important process consideration]
- [Important state or transition consideration]
- [Important quality or consistency consideration]
- [Other important constraint or note]
TEMPLATE_PLACEHOLDER_END -->

- Supported stage-level launch points:
  - Design generation or update
  - Implementation generation or update
  - Validation
- Checkpoint:
  - Review interpreted requirement outputs
  - Review design outputs
  - Review implementation outputs
- Failure handling:
  - Stop at the current failed stage
  - Do not roll back automatically
  - Restart from the same stage after the issue is fixed

---

## 6. Non-Functional Considerations

<!-- TEMPLATE_GUIDANCE_START
Writing Hints: Use this section to deep-dive into the non-functional considerations that materially shape the architecture, and use common examples such as high availability, high scalability, and high performance.
TEMPLATE_GUIDANCE_END -->

### 6.1 High Availability
- Why it matters:
  - The platform should remain available when part of the system fails.
- Architectural support:
  - Servers should support deployment on multiple machines to reduce single-point failure risk.
  - Services should be separated so part of the platform can still work when another part fails.
  - The platform should expose error information when system failure happens.

### 6.2 High Scalability

- Why it matters:
  - The platform should support more tasks, scenarios, and user-defined rules in the future.
- Architectural support:
  - Workflow should support more task types in future stages.
  - Contract should support user-defined customization.

### 6.3 High Performance

- Why it matters:
  - The platform should reduce waiting time for generation and validation tasks.
- Architectural support:
  - Parallelization should be supported when possible, especially for design and implementation related execution units.

---

## 7. Design Documents

### 7.1 Design Document Categories

Different design documents have different focus. All of them must still follow the module boundaries, dependency rules, and common stage pipeline defined in this architecture.

Design categories:

- Process design
  - focus on flow, state, stage transitions, control logic, error handling, and internal code structure
- Data design
  - focus on data model, field definitions, storage layout, public storage API, consistency rules, and persistence behavior
- Rule design
  - focus on validation target, rule definitions, check logic, issue model, and result structure
- Interface contract design
  - focus on shared APIs, request/response boundaries, and interaction rules between modules

### 7.2 Design Document Breakdown

<!-- TEMPLATE_GUIDANCE_START
Writing Hints:
- Keep this section lightweight.
- List only follow-up design documents that are really needed after this architecture document.
- Focus on document scope rather than module internals.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
- [Design Document A]: [Scope]
- [Design Document B]: [Scope]
- [Design Document C]: [Scope]
- [Design Document D]: [Scope]
TEMPLATE_PLACEHOLDER_END -->

#### 7.2.1 Start Task

- Cross-Module API Contracts: shared public APIs and request/response boundaries for cross-module calls.
- Interface/CLI Design: CLI-based task trigger and CLI interaction flow.
- Workflow/Pipeline Design: task start, stage selection, stage entry, and workflow control.

#### 7.2.2 Generate Or Update Stage Artifact

- Execution/RequirementInterpreter Design: requirement interpretation logic and requirement-stage execution flow.
- Execution/ArchitectureDesignGenerator Design: architecture design generation logic and architecture-stage execution flow.
- Execution/ModuleDesignGenerator Design: module design generation logic and module-design-stage execution flow.
- Execution/ImplementationGenerator Design: implementation generation logic for code and test artifacts.
- Execution/ValidationRunner Design: validation execution flow and validation result generation.
- Data/ArtifactStore Design: staged artifact storage and generated artifact persistence.

#### 7.2.3 Check Stage Result

- Contract/RequirementContract Design: requirement-stage input/output structure rules and validation contracts.
- Contract/ArchitectureDesignContract Design: architecture design input/output structure rules and validation contracts.
- Contract/ModuleDesignContract Design: module design input/output structure rules and validation contracts.
- Contract/ImplementationContract Design: implementation-stage input/output structure rules and validation contracts.

#### 7.2.4 Review And Decision

- QualityGate/ChangeGate Design: review, reject, and apply decision handling for pending changes.

#### 7.2.5 Store Artifact And History

- QualityGate/Trace Design: review status tracking, pending review visibility, and important progress information.
- Data/ArtifactStore Design: accepted artifact storage and downstream artifact lookup.
- Data/HistoryStore Design: workflow history, operation records, and process trace storage.

---

## 8. Open Issues

<!-- TEMPLATE_GUIDANCE_START
Goal:
Record unresolved questions, risks, or assumptions that still require clarification.

Writing Hints:
- Include only unresolved items that may affect architecture decisions.
- Separate real open issues from minor implementation details.
- Make assumptions explicit where needed.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
- [Open issue 1]
- [Open issue 2]
- [Risk or assumption 1]
TEMPLATE_PLACEHOLDER_END -->

---
