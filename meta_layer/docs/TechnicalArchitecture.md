# Technical Architecture

## 1. Purpose

<!-- TEMPLATE_GUIDANCE_START
Writing Hints:
- State the purpose of this document in one short sentence.
- List the main readers and why they should read it.
- Keep the content at overall architecture level.
TEMPLATE_GUIDANCE_END -->

Define the overall technical architecture of the AI-RD platform.

- Teammbers: provide a shared high-level baseline for the team.
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

### 3.1 end-to-end work-flow support
The architecture must supprt the full folw from requirement input to desing generation、implementation generation, review, validation adn acceptance

### 3.2 requirement interpretation as stable upstream input
Requirement documents written in natural language must be checked and stabilized before they are used as downstream input. So the architecture needs requirement interpretation and contract-based checks to make requirement outputs become stable input for the next stage.

### 3.3 design doc interpretation as stable upstream input

Design outputs generated in upstream stages must be checked and stabilized before they are used as downstream input. So the architecture needs contract-based checks and gate decisions to make architecture design outputs and module design outputs become stable input for the next stage.

### 3.4 hunman-in-loop control
Important changes must remain human reviewable and require users to confirm. So the architecture needs explict review and apply point

### 3.5 Validation visibility
The system must provide validation or test feedback for generated outputs, so validation needs to be a first-class part of the workflow

### 3.6 Evolation form cli to UI
CLI-first, while later versions add UI-based workflow support, so the architecture should separate core workflow logic from interface-specific layers.

### 3.7 execution transparency and stage traceability
Users need to understand what the platform is doing at each stage, so the architecture should make execution process, stage status, and important changes visible and traceable.

### 3.8 incremental update on requirement changes
requirements change is frequency, so the architecture should support compare the changes between different version and generage new changes to downstream stages.

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

- Interface: entrance and info shows, eg: cli, ui
- Workflow: control process, state/context, resume, and retry
- Execution: real ability of task, eg: requirement interpretation, design/implement generation
- Contract: define the required structure and validation contract for stage inputs and outputs.
- QualityGate: manage review, reject, and apply decisions for pending changes, and decide whether reviewed results are allowed to pass to the next stage.
- Data: storage data like intermediate outpts from Execution/Workflow/QualityGate.

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
|   CLI / FutureUI |
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


- Interface/UI: show process information and provide future UI-based task entry.
- Interface/CLI: trigger workflow-related tasks through CLI.
- Interface/ServiceApi: handle service-side API requests, task requests, responses, and error handling.
- Workflow/Pipeline: control workflow execution, stage state, and resume.
- Execution/RequirementInterpreter: turn raw requirement documents into structured and stable upstream input.
- Contract/RequirementContract: define the required structure and validation contract for requirement-stage inputs and outputs.
- Execution/ArchitectureDesignGenerator: generate architecture design documents and check whether they meet requirements.
- Contract/ArchitectureDesignContract: define the required structure and validation contract for architecture design inputs and outputs.
- Execution/ModuleDesignGenerator: generate module design documents from upstream architecture design outputs and check whether they meet requirements.
- Contract/ModuleDesignContract: define the required structure and validation contract for module design inputs and outputs.
- Execution/ImplementationGenerator: generate code and test artifacts from upstream module design outputs.
- Contract/ImplementationContract: define the required structure and validation contract for implementation-stage inputs and outputs.
- Execution/ValidationRunner: run validation and check whether generated outputs pass required tests.
- QualityGate/Trace: provide visible review status, pending review items, and important progress information.
- QualityGate/ChangeGate: manage review, reject, and apply decisions based on contracts and required checks.
- Data/HistoryStore: store workflow history and operation records.
- Data/ArtifactStore: store raw files and generated artifacts, such as documents and resources.


### 5.2 Interaction Model
<!-- TEMPLATE_PLACEHOLDER: [Explain how the modules collaborate at a high level.] -->

- Interface/UI -> Interface/CLI: reuse the CLI entry path to start workflow tasks
- Interface/CLI -> Interface/ServiceApi: send workflow task request
- Interface/ServiceApi -> Workflow/Pipeline: start workflow task

- Workflow/Pipeline -> Execution/RequirementInterpreter: interpret raw requirement input
- Workflow/Pipeline -> Contract/RequirementContract: check requirement

- Workflow/Pipeline -> Execution/ArchitectureDesignGenerator: generate architecture design output
- Workflow/Pipeline -> Contract/ArchitectureDesignContract: check Architecture design

- Workflow/Pipeline -> Execution/ModuleDesignGenerator: generate module design output
- Workflow/Pipeline -> Contract/ModuleDesignContract: check module design

- Workflow/Pipeline -> Execution/ImplementationGenerator: generate intermediate resouces eg: code,test_case,config
- Workflow/Pipeline -> Contract/ImplementationContract: check result of final arifacts. eg: test_case

- Workflow/Pipeline -> Execution/ValidationRunner: run to validation 
- Workflow/Pipeline -> QualityGate/ChangeGate: submit stage results together with contract check results for review, reject, or apply decisions

- Workflow/Pipeline -> QualityGate/Trace: notify important infos
- QualityGate/Trace -> Data/HistoryStore: save important process info. 
- Execution/* -> Data/ArtifactStore: save generated artifacts
- Contract/* -> Data/ArtifactStore: load/store contract definitions

### 5.3 Main Flow
```text
Interface/UI
    |
    v
Interface/CLI
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

1. Interface/UI or Interface/CLI starts a workflow task, and the request enters Workflow/Pipeline through Interface/ServiceApi.
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

---

## 6. Quality Attributes

<!-- TEMPLATE_GUIDANCE_START
Goal:
Describe the quality attributes that materially affect the architecture.

Writing Hints:
- Include only quality attributes that materially shape the design.
- Add or remove subsections as needed.
- For each attribute, state why it matters and how the architecture supports it.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_GUIDANCE_START
Suggested candidates:
- Reliability
- Availability
- Scalability
- Security
- Observability
- Traceability
- Operability
- Extensibility
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
### 6.x [Quality Attribute Name]
- Why it matters:
- Architectural support:

### 6.x [Quality Attribute Name]
- Why it matters:
- Architectural support:

### 6.x [Quality Attribute Name]
- Why it matters:
- Architectural support:
TEMPLATE_PLACEHOLDER_END -->

---

## 7. Evolution Strategy

<!-- TEMPLATE_GUIDANCE_START
Goal:
Describe how the architecture can evolve over time while preserving core consistency.

Writing Hints:
- Distinguish between stable foundation and future extension points.
- Focus on how the architecture can absorb future change.
- Keep this section at architectural level rather than implementation roadmap detail.
TEMPLATE_GUIDANCE_END -->

### 7.1 Current Baseline
<!-- TEMPLATE_PLACEHOLDER: [Describe the current architectural baseline.] -->

### 7.2 Stable Core
<!-- TEMPLATE_PLACEHOLDER: [Describe what should remain stable as the system evolves.] -->

### 7.3 Extension Points
<!-- TEMPLATE_PLACEHOLDER: [Describe where change or extension is expected.] -->

### 7.4 Evolution Direction
<!-- TEMPLATE_PLACEHOLDER_START
- [Evolution direction 1]
- [Evolution direction 2]
- [Evolution direction 3]
TEMPLATE_PLACEHOLDER_END -->

---

## 8. Module Design Decomposition

<!-- TEMPLATE_GUIDANCE_START
Goal:
Define how the architecture should be broken down into follow-up module design documents.

Writing Hints:
- Keep this section lightweight.
- Focus on decomposition strategy rather than module internals.
- Clarify how later design documents relate back to this architecture.
TEMPLATE_GUIDANCE_END -->

### 8.1 Decomposition Principle
<!-- TEMPLATE_PLACEHOLDER: [Explain how detailed module design documents are divided.] -->

### 8.2 Suggested Module Design Documents
<!-- TEMPLATE_PLACEHOLDER_START
- [Module Design A]: [Scope]
- [Module Design B]: [Scope]
- [Module Design C]: [Scope]
- [Module Design D]: [Scope]
TEMPLATE_PLACEHOLDER_END -->

### 8.3 Relationship to This Document
<!-- TEMPLATE_PLACEHOLDER: [Explain that this document defines overall structure, boundaries, and key design decisions, while module design documents define the detailed solution within those constraints.] -->

---

## 9. Open Issues

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

## 10. Summary

<!-- TEMPLATE_GUIDANCE_START
Goal:
Summarize the architecture direction and reaffirm the role of this document.

Writing Hints:
- Keep this section short.
- Restate the architecture direction clearly.
- Explain how this document should guide subsequent design work.

Placeholder:
[Summarize the architecture direction, key structural characteristics, and the role of this document in guiding later module-level design.]
TEMPLATE_GUIDANCE_END -->
