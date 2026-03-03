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
- Detailed API contracts, prompt content, and parameter definitions.
- Database schema details and storage-level design.
- UI-level interaction design and visual behavior details.
- Deployment runbooks, environment setup, and operational procedures.

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
The platform is CLI-first, while later versions add UI-based workflow support, so the architecture should separate core workflow logic from interface-specific layers.

### 3.7 execution transparency and stage traceability
Users need to understand what the platform is doing at each stage, so the architecture should make execution process, stage status, and important changes visible and traceable.

### 3.8 incremental update on requirement changes
Requirement changes are frequent, so the architecture should support comparing changes between different versions and generating downstream updates.

### 3.9 Stage-level resumability
The architecture should support stage-level resumability as a core capability based on clear stage inputs, outputs, and state, so users can start from a selected intermediate stage when the required inputs are available, and the workflow can recover from stage failure without rerunning the whole workflow.

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
- Workflow: control process, state/context, resume, and retry
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
|  CLI / Future UI |
+------------------+
          |
          v
+------------------+
| Workflow         |
| process/state/   |
| context/resume   |
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

---

## 5. System Flow

<!-- TEMPLATE_GUIDANCE_START
Goal:
Explain the key system-level flow, module interactions, and control points that shape runtime behavior.

Writing Hints:
- Describe only the runtime interactions needed to understand the system flow.
- Focus on module collaboration, main flow, and control points rather than module internals.
- Make the main execution or request path explicit.
- Identify review, approval, validation, resume, retry, or control points where relevant.
TEMPLATE_GUIDANCE_END -->

### 5.1 Core Modules
<!-- TEMPLATE_PLACEHOLDER_START
- [Module A]: [High-level responsibility]
- [Module B]: [High-level responsibility]
- [Module C]: [High-level responsibility]
- [Module D]: [High-level responsibility]
TEMPLATE_PLACEHOLDER_END -->


- Interface/UI: provide UI-based user interaction, workflow entry, and optional CLI capability reuse.
- Interface/CLI: trigger workflow-related tasks through CLI.
- Interface/ServiceApi: handle service-side API requests, task requests, responses, and error handling.
- Workflow/Pipeline: control workflow execution, stage state, resume, and retry.
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


### 5.2 Interaction Model
<!-- TEMPLATE_PLACEHOLDER: [Explain how the modules collaborate at a high level.] -->

- Interface/UI -> Interface/ServiceApi: send UI-based workflow task request
- Interface/CLI -> Interface/ServiceApi: send CLI-based workflow task request
- Interface/UI -> Interface/CLI: optionally reuse CLI capabilities when needed
- Interface/ServiceApi -> Workflow/Pipeline: start workflow task

- Workflow/Pipeline -> Execution/RequirementInterpreter: interpret raw requirement input
- Workflow/Pipeline -> Contract/RequirementContract: check requirement-stage input/output, report issues, and return the result for next-step decision

- Workflow/Pipeline -> Execution/ArchitectureDesignGenerator: generate architecture design output
- Workflow/Pipeline -> Contract/ArchitectureDesignContract: check architecture-design-stage input/output, report issues, and return the result for the next-step decision

- Workflow/Pipeline -> Execution/ModuleDesignGenerator: generate module design output
- Workflow/Pipeline -> Contract/ModuleDesignContract: check module-design-stage input/output, report issues, and return the result for the next-step decision

- Workflow/Pipeline -> Execution/ImplementationGenerator: generate intermediate resources, for example code, test cases, and config
- Workflow/Pipeline -> Contract/ImplementationContract: check implementation-stage input/output, report issues, and return the result for the next-step decision

- Workflow/Pipeline -> Execution/ValidationRunner: run validation
- Workflow/Pipeline -> QualityGate/ChangeGate: submit stage results together with contract check results for review, reject, or apply decisions

- Workflow/Pipeline -> QualityGate/Trace: notify important process information
- QualityGate/Trace -> Data/HistoryStore: save important process information
- Execution/* -> Data/ArtifactStore: save generated artifacts
- Contract/* -> Data/ArtifactStore: load/store contract definitions

### 5.3 Main Flow
```text
Interface/UI -----------+
    |                   |
    | optional CLI use  v
    |             Interface/CLI
    |                   |
    +-------------------+
            task request
                 |
                 v
      Interface/ServiceApi
                 |
                 v
Workflow/Pipeline
    |
    +--> Execution/*
    |      |
    |      +--> Data/ArtifactStore
    |      |
    |      +--> callback stage output to Workflow/Pipeline
    |
    +--> Contract/*
    |      |
    |      +--> Data/ArtifactStore
    |      |
    |      +--> callback check result to Workflow/Pipeline
    |
    +--> QualityGate/ChangeGate
    |      |
    |      +--> review / reject / apply decision
    |      |
    |      +--> callback decision to Workflow/Pipeline
    |
    +--> QualityGate/Trace
           |
           +--> Data/HistoryStore
```

1. Interface/UI or Interface/CLI starts a workflow task, and the request enters Workflow/Pipeline through Interface/ServiceApi. Interface/UI can also optionally reuse CLI capabilities when needed.
2. Workflow/Pipeline sends stage input to the corresponding Execution module, and the Execution module generates stage output and returns the result to Workflow/Pipeline.
3. Workflow/Pipeline sends the returned output to the corresponding Contract module as input, and the Contract module checks the result and returns the check result to Workflow/Pipeline.
4. Workflow/Pipeline sends the contract check result together with the stage result to QualityGate/ChangeGate, and QualityGate/ChangeGate returns review, reject, or apply decisions to Workflow/Pipeline.
5. Workflow/Pipeline uses the returned decision to determine whether to continue, stop, retry, or move to the next stage.
6. During the flow, Workflow/Pipeline sends important process information to QualityGate/Trace, which stores workflow history through the Data layer, while Execution or Contract modules store generated artifacts and contract-related data through the Data layer. The same interaction pattern is reused across requirement interpretation, design generation, implementation generation, and validation stages.

### 5.4 Key Considerations
<!-- TEMPLATE_PLACEHOLDER_START
- [Important process consideration]
- [Important state or transition consideration]
- [Important quality or consistency consideration]
- [Other important constraint or note]
TEMPLATE_PLACEHOLDER_END -->

- Supported stage-level start points:
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

## 7. Design Document Breakdown

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

- Interface/UI Design: UI-based entry, process display, and future UI interaction design.
- Interface/CLI Design: CLI-based task trigger and CLI interaction flow.
- Interface/ServiceApi Design: service-side API request handling, task request handling, response handling, and error handling.
- Workflow/Pipeline Design: workflow execution, stage state, resume, retry, and stage transition control.
- Execution/RequirementInterpreter Design: requirement interpretation logic and requirement-stage execution flow.
- Contract/RequirementContract Design: requirement-stage input/output structure rules and validation contracts.
- Execution/ArchitectureDesignGenerator Design: architecture design generation logic and architecture-stage execution flow.
- Contract/ArchitectureDesignContract Design: architecture design input/output structure rules and validation contracts.
- Execution/ModuleDesignGenerator Design: module design generation logic and module-design-stage execution flow.
- Contract/ModuleDesignContract Design: module design input/output structure rules and validation contracts.
- Execution/ImplementationGenerator Design: implementation generation logic for code and test artifacts.
- Contract/ImplementationContract Design: implementation-stage input/output structure rules and validation contracts.
- Execution/ValidationRunner Design: validation execution flow and validation result generation.
- QualityGate/Trace Design: review status tracking, pending review visibility, and important progress information.
- QualityGate/ChangeGate Design: review, reject, and apply decision handling for pending changes.
- Data/HistoryStore Design: workflow history, operation records, and process trace storage.
- Data/ArtifactStore Design: raw file storage and generated artifact storage.

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
