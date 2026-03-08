<!--
{
  "document_contracts": [
    {
      "check_item": "document_structure_complete",
      "description": "The document should contain the required architecture sections, subsection structure, and lightweight architecture-level detail.",
      "severity": "high"
    },
    {
      "check_item": "architecture_level_consistency",
      "description": "The document should stay at technical architecture level and should not drift into module-internal implementation detail.",
      "severity": "high"
    },
    {
      "check_item": "cross_section_alignment",
      "description": "Architecture style, dependency rules, runtime flow, design document breakdown, and open issues should remain logically consistent across sections.",
      "severity": "high"
    }
  ]
}
-->

# Technical Architecture

## 1. Purpose

<!--
{
  "section_contract": {
    "section_id": "1",
    "title": "Purpose",
    "checkitems": [
      "state the purpose of this document in one short sentence",
      "list the main readers and why they should read it",
      "keep the content at overall architecture level"
    ],
    "severity": "medium",
    "expected_format": "Define the overall technical architecture of the `{SystemName}` platform.\n\n- Team members: provide a shared high-level baseline for the team.\n- Senior engineers: review architecture direction and boundaries.\n- Junior engineers: understand system and module structure for later design and implementation."
  }
}
-->

Define the overall technical architecture of the AI-RD platform.

- Team members: provide a shared high-level baseline for the team.
- Senior engineers: review architecture direction and boundaries.
- Junior engineers: understand system and module structure for later design and implementation.


## 2. Scope

<!--
{
  "section_contract": {
    "section_id": "2",
    "title": "Scope",
    "checkitems": [
      "define what this document covers",
      "define what this document does not cover",
      "clarify the boundary between overall architecture and module design"
    ],
    "severity": "medium"
  }
}
-->

### 2.1 In Scope

<!--
{
  "section_contract": {
    "section_id": "2.1",
    "title": "In Scope",
    "checkitems": [
      "list only architecture-level concerns",
      "focus on workflow, major modules, boundaries, and key constraints"
    ],
    "severity": "medium",
    "expected_format": "- Overall workflow from requirement input to design generation, implementation generation, review, validation, and acceptance.\n- Major modules and their responsibilities at architecture level.\n- Collaboration boundaries and dependency direction between major parts of the system.\n- Key architecture constraints related to reviewability, controllability, validation, and evolution."
  }
}
-->

- Overall workflow from requirement input to design generation, implementation generation, review, validation, and acceptance.
- Major modules and their responsibilities at architecture level.
- Collaboration boundaries and dependency direction between major parts of the system.
- Key architecture constraints related to reviewability, controllability, validation, and evolution.

### 2.2 Out of Scope

<!--
{
  "section_contract": {
    "section_id": "2.2",
    "title": "Out of Scope",
    "checkitems": [
      "exclude module internals and implementation-level detail",
      "exclude storage schema, UI detail, and runbook detail unless they materially shape architecture"
    ],
    "severity": "medium",
    "expected_format": "- Detailed module internals and implementation logic.\n- Detailed API contracts, prompt content, and parameter definitions inside each module.\n- Database schema details and storage-level design.\n- UI-level interaction design and visual behavior details.\n- Deployment runbooks, environment setup, and operational procedures.\n\nCross-module interaction contracts are covered at a lightweight shared-boundary level in a separate design document, not in full module-level detail here."
  }
}
-->

- Detailed module internals and implementation logic.
- Detailed API contracts, prompt content, and parameter definitions inside each module.
- Database schema details and storage-level design.
- UI-level interaction design and visual behavior details.
- Deployment runbooks, environment setup, and operational procedures.

Cross-module interaction contracts are covered at a lightweight shared-boundary level in a separate design document, not in full module-level detail here.

---

## 3. Design Drivers

<!--
{
  "section_contract": {
    "section_id": "3",
    "title": "Design Drivers",
    "checkitems": [
      "capture only drivers that materially shape architecture decisions",
      "include functional and non-functional drivers when they affect structure",
      "avoid generic statements that do not influence architecture"
    ],
    "severity": "medium"
  }
}
-->

### 3.1 end-to-end workflow support

<!--
{
  "section_contract": {
    "section_id": "3.1",
    "title": "end-to-end workflow support",
    "checkitems": [
      "state the driver clearly",
      "explain why full workflow support shapes architecture"
    ],
    "severity": "medium",
    "expected_format": "The architecture must support the full flow from requirement input to design generation, implementation generation, review, validation, and acceptance."
  }
}
-->

The architecture must support the full flow from requirement input to design generation, implementation generation, review, validation, and acceptance.

### 3.2 requirement interpretation as stable upstream input

<!--
{
  "section_contract": {
    "section_id": "3.2",
    "title": "requirement interpretation as stable upstream input",
    "checkitems": [
      "explain why raw requirement documents cannot be consumed directly downstream",
      "connect the driver to requirement interpretation and contract-based checks"
    ],
    "severity": "medium",
    "expected_format": "Requirement documents written in natural language must be checked and stabilized before they are used as downstream input. So the architecture needs requirement interpretation and contract-based checks to make requirement outputs become stable input for the next stage."
  }
}
-->

Requirement documents written in natural language must be checked and stabilized before they are used as downstream input. So the architecture needs requirement interpretation and contract-based checks to make requirement outputs become stable input for the next stage.

### 3.3 design doc interpretation as stable upstream input

<!--
{
  "section_contract": {
    "section_id": "3.3",
    "title": "design doc interpretation as stable upstream input",
    "checkitems": [
      "explain why design outputs need stabilization before downstream use",
      "connect the driver to contract checks and gate decisions"
    ],
    "severity": "medium",
    "expected_format": "Design outputs generated in upstream stages must be checked and stabilized before they are used as downstream input. So the architecture needs contract-based checks and gate decisions to make architecture design outputs and module design outputs become stable input for the next stage."
  }
}
-->

Design outputs generated in upstream stages must be checked and stabilized before they are used as downstream input. So the architecture needs contract-based checks and gate decisions to make architecture design outputs and module design outputs become stable input for the next stage.

### 3.4 human-in-the-loop control

<!--
{
  "section_contract": {
    "section_id": "3.4",
    "title": "human-in-the-loop control",
    "checkitems": [
      "state why human review remains necessary",
      "connect the driver to explicit review and apply points"
    ],
    "severity": "medium",
    "expected_format": "Important changes must remain human-reviewable and require users to confirm. So the architecture needs explicit review and apply points."
  }
}
-->

Important changes must remain human-reviewable and require users to confirm. So the architecture needs explicit review and apply points.

### 3.5 Validation visibility

<!--
{
  "section_contract": {
    "section_id": "3.5",
    "title": "Validation visibility",
    "checkitems": [
      "state why validation feedback must be visible",
      "explain why validation is a first-class workflow concern"
    ],
    "severity": "medium",
    "expected_format": "The system must provide validation or test feedback for generated outputs, so validation needs to be a first-class part of the workflow."
  }
}
-->

The system must provide validation or test feedback for generated outputs, so validation needs to be a first-class part of the workflow

### 3.6 evolution from CLI to UI

<!--
{
  "section_contract": {
    "section_id": "3.6",
    "title": "evolution from CLI to UI",
    "checkitems": [
      "state the current interface scope and future evolution path",
      "preserve separation between workflow logic and interface logic"
    ],
    "severity": "medium",
    "expected_format": "The platform is CLI-only in the current scope. Future interface evolution should not break the separation between workflow logic and interface-specific logic."
  }
}
-->

The platform is CLI-only in the current scope. Future interface evolution should not break the separation between workflow logic and interface-specific logic.

### 3.7 execution transparency and stage traceability

<!--
{
  "section_contract": {
    "section_id": "3.7",
    "title": "execution transparency and stage traceability",
    "checkitems": [
      "state why users need runtime transparency",
      "connect the driver to stage status and trace visibility"
    ],
    "severity": "medium",
    "expected_format": "Users need to understand what the platform is doing at each stage, so the architecture should make execution process, stage status, and important changes visible and traceable."
  }
}
-->

Users need to understand what the platform is doing at each stage, so the architecture should make execution process, stage status, and important changes visible and traceable.

### 3.8 incremental update on requirement changes

<!--
{
  "section_contract": {
    "section_id": "3.8",
    "title": "incremental update on requirement changes",
    "checkitems": [
      "state why requirement changes are expected",
      "connect the driver to change comparison and downstream update support"
    ],
    "severity": "medium",
    "expected_format": "Requirement changes are frequent, so the architecture should support comparing changes between different versions and generating downstream updates."
  }
}
-->

Requirement changes are frequent, so the architecture should support comparing changes between different versions and generating downstream updates.

### 3.9 Stage-level launch flexibility

<!--
{
  "section_contract": {
    "section_id": "3.9",
    "title": "Stage-level launch flexibility",
    "checkitems": [
      "state why users may need to start from an intermediate stage",
      "connect the driver to required-input availability"
    ],
    "severity": "medium",
    "expected_format": "The architecture should support launching from a selected stage when the required inputs are available, so users can start from an intermediate stage without rerunning the whole workflow."
  }
}
-->

The architecture should support launching from a selected stage when the required inputs are available, so users can start from an intermediate stage without rerunning the whole workflow.

# 4. Architecture Design

<!--
{
  "section_contract": {
    "section_id": "4",
    "title": "Architecture Design",
    "checkitems": [
      "describe the overall architecture of the system",
      "start from architectural approach and partitioning",
      "explain dependency direction and structural constraints",
      "include one high-level diagram"
    ],
    "severity": "medium"
  }
}
-->


### 4.1 Architecture Style

<!--
{
  "section_contract": {
    "section_id": "4.1",
    "title": "Architecture Style",
    "checkitems": [
      "describe the overall architectural style such as layered, modular monolith, service-oriented, event-driven, or hybrid",
      "keep the description at system architecture level"
    ],
    "severity": "medium",
    "expected_format": "The system adopts a `{ArchitectureStyle}` architecture."
  }
}
-->

The system adopts a layered modular architecture

### 4.2 Layers or Partitions

<!--
{
  "section_contract": {
    "section_id": "4.2",
    "title": "Layers or Partitions",
    "checkitems": [
      "list the major architecture partitions only",
      "make responsibility boundaries explicit",
      "keep names aligned with the rest of the architecture document"
    ],
    "severity": "medium",
    "expected_format": "- `{LayerA}`: `{ResponsibilityA}`\n- `{LayerB}`: `{ResponsibilityB}`\n- `{LayerC}`: `{ResponsibilityC}`"
  }
}
-->

- Interface: system entry and information display, for example CLI and UI.
- Workflow: control process, state/context, stage entry, and retry
- Execution: stage execution capabilities, for example requirement interpretation, design generation, implementation generation, and validation.
- SDK: shared technical capabilities, for example shared llm execution.
- Contract: check whether stage inputs and outputs meet required structure and rules, and return issues and check results.
- QualityGate: manage review, reject, and apply decisions for pending changes, and decide whether results are allowed to pass to the next stage based on returned check results.
- Data: store shared data such as intermediate outputs from Execution and process records from QualityGate.

### 4.3 Allowed Dependencies

<!--
{
  "section_contract": {
    "section_id": "4.3",
    "title": "Allowed Dependencies",
    "checkitems": [
      "define dependency rules by allowed relations only",
      "treat all unspecified dependencies as forbidden by default",
      "keep the rules aligned with the defined layers or partitions"
    ],
    "severity": "medium",
    "expected_format": "ALLOW:\n- `{SourceA}` -> `{TargetA}`\n- `{SourceB}` -> `{TargetB}`\n- `{SourceC}` -> `{TargetC}`"
  }
}
-->

ALLOW:
- Interface -> Workflow
- Workflow -> Execution
- Workflow -> Contract
- Workflow -> QualityGate
- Execution -> SDK
- Contract -> SDK
- QualityGate -> Data
- Execution -> Data

Cross-module collaboration rule:

- `Workflow/Pipeline` owns the shared collaboration interfaces used across module boundaries.
- `Execution/*`, `QualityGate/*`, and `Data/*` modules implement these workflow-owned interfaces when they expose capabilities to other modules.
- Modules must not directly depend on another module's implementation file for cross-module collaboration.
- Concrete implementation binding is completed only in the application composition root.

### 4.4 High-level Diagram

<!--
{
  "section_contract": {
    "section_id": "4.4",
    "title": "High-level Diagram",
    "checkitems": [
      "show the main architecture parts and dependency direction",
      "keep the diagram high level and readable"
    ],
    "severity": "medium",
    "expected_format": "```text\n[High-level architecture diagram here]\n```"
  }
}
-->

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

<!--
{
  "section_contract": {
    "section_id": "4.5",
    "title": "Runtime Topology",
    "checkitems": [
      "describe the backend runtime and deployment view in a lightweight way",
      "clarify which major parts run together, which parts may be separated, and how shared storage is used",
      "keep the content at runtime topology level rather than deployment runbook detail"
    ],
    "severity": "medium",
    "expected_format": "- `{RuntimeNodeA}`: `{ResponsibilityA}`\n- `{RuntimeNodeB}`: `{ResponsibilityB}`\n- `{SharedInfrastructure}`: `{ResponsibilityC}`"
  }
}
-->

- Interface/CLI: runtime entry for workflow requests in the current scope.
- Workflow/Pipeline, Contract/*, QualityGate/*: run in the core backend service in V1.
- Execution/*: run in the core backend service in V1; they can be split into workers later.
- SDK/*, including shared `SDK/LlmExecutor`: run in the core backend service in V1.
- Data/HistoryStore and Data/ArtifactStore: shared storage, implemented by local, backend-managed, or cloud storage.
- Application composition root: binds workflow-owned collaboration interfaces to concrete module implementations before the runtime starts serving requests.

---

## 5. System Flow

<!--
{
  "section_contract": {
    "section_id": "5",
    "title": "System Flow",
    "checkitems": [
      "describe only the runtime interactions needed to understand the system flow",
      "focus on module collaboration, main flow, and control points rather than module internals",
      "make the main execution path explicit"
    ],
    "severity": "medium"
  }
}
-->

### 5.1 Main Flow

<!--
{
  "section_contract": {
    "section_id": "5.1",
    "title": "Main Flow",
    "checkitems": [
      "make the main execution or request path explicit",
      "show the reusable control shape across stages",
      "identify review, approval, validation, stage entry, retry, or control points where relevant"
    ],
    "severity": "medium",
    "expected_format": "```text\n[Main flow diagram here]\n```\n\n1. `{Step1}`\n2. `{Step2}`\n3. `{Step3}`\n\n`{FlowSummary}`"
  }
}
-->

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
4. For non-validation stages, the generated result is checked by the corresponding `Contract/*` module and then submitted to `QualityGate/*` for review and decision; for validation stage, contract check is skipped and the validation result is submitted to `QualityGate/*` for final confirmation.
5. During the stage flow, artifact results and workflow history are stored through the Data layer.
6. After the stage finishes, Workflow/Pipeline decides whether to continue to the next stage, stop, retry, or wait for user action.
7. The same main flow pattern is reused across requirement interpretation, design generation, implementation generation, and validation stages, with a validation-stage exception on contract only.

Each stage follows the same control shape: load source or upstream artifacts, generate or update the stage artifact, check the result, review the result, and store the accepted output.

Cross-module collaboration in this flow uses workflow-owned interfaces. Concrete service implementations are bound in the application composition root and are not referenced directly across module boundaries.

Exception for validation stage in V1: `Contract/ValidationContract` does not require `Contract/*` check, but it requires `QualityGate/*` review to confirm final validation success/failure information; confirmed success is treated as stage pass, and confirmed failure ends the workflow.

### 5.2 Core Modules

<!--
{
  "section_contract": {
    "section_id": "5.2",
    "title": "Core Modules",
    "checkitems": [
      "list only the modules needed to understand the architecture",
      "keep responsibilities high level"
    ],
    "severity": "medium",
    "expected_format": "- `{ModuleA}`: `{ResponsibilityA}`\n- `{ModuleB}`: `{ResponsibilityB}`\n- `{ModuleC}`: `{ResponsibilityC}`"
  }
}
-->

- Interface/CLI: trigger workflow-related tasks through CLI.
- Workflow/Pipeline: control workflow execution, stage state, stage entry, and retry.
- Execution/RequirementGenerator: turn raw requirement documents into structured and stable upstream input.
- SDK/LlmExecutor: provide shared agent-based llm execution capability through prompt-in and model-result-out abstraction for modules that need llm execution.
- Contract/RequirementContract: check whether requirement-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ArchitectureDesignGenerator: generate architecture design documents from upstream stable input.
- Contract/ArchitectureDesignContract: check whether architecture-design-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ModuleDesignGenerator: generate module design documents from upstream stable architecture design input.
- Contract/ModuleDesignContract: check whether module-design-stage inputs and outputs meet required structure and rules, and report issues.
- Execution/ImplementationGenerator: generate code and test artifacts from upstream module design outputs.
- Contract/ImplementationContract: check whether implementation-stage inputs and outputs meet required structure and rules, and report issues.
- Contract/ValidationContract: check validation-stage output and produce contract-check results for final confirmation.
- QualityGate/Trace: provide visible review status, pending changes, and important progress information.
- QualityGate/ChangeGate: manage review, reject, and apply decisions based on contracts and required checks.
- Data/HistoryStore: store workflow history and operation records.
- Data/ArtifactStore: store raw files and generated artifacts, such as documents and resources.


### 5.3 Interaction Model

<!--
{
  "section_contract": {
    "section_id": "5.3",
    "title": "Interaction Model",
    "checkitems": [
      "explain how modules collaborate at a high level",
      "group interactions by major flow step or control point",
      "keep this section at workflow-level interaction rather than module-internal detail"
    ],
    "severity": "medium",
    "expected_format": "This section describes workflow-level module interaction. The concrete public APIs for these cross-module calls are defined in `{CrossModuleDocPath}`."
  }
}
-->

This section describes workflow-level module interaction. The concrete public APIs for these cross-module calls are defined in `System Interaction Design` (`design_docs/SystemInteractionDesign.md`).

#### 5.3.1 Start Task

<!--
{
  "section_contract": {
    "section_id": "5.3.1",
    "title": "Start Task",
    "checkitems": [
      "describe how the workflow task is started",
      "write each interaction as `Source -> Target: purpose`"
    ],
    "severity": "medium",
    "expected_format": "- `{SourceA}` -> `{TargetA}`: `{PurposeA}`"
  }
}
-->

- Interface/CLI -> Workflow/Pipeline: start workflow task

#### 5.3.2 Generate Or Update Stage Artifact

<!--
{
  "section_contract": {
    "section_id": "5.3.2",
    "title": "Generate Or Update Stage Artifact",
    "checkitems": [
      "describe generation and update related interactions",
      "include shared llm execution interactions when relevant"
    ],
    "severity": "medium",
    "expected_format": "- `{SourceA}` -> `{TargetA}`: `{PurposeA}`\n- `{SourceB}` -> `{TargetB}`: `{PurposeB}`"
  }
}
-->

- Execution/RequirementGenerator -> SDK/LlmExecutor: execute requirement interpretation request through shared llm execution capability
- Execution/ArchitectureDesignGenerator -> SDK/LlmExecutor: execute architecture-design generation request through shared llm execution capability
- Execution/ModuleDesignGenerator -> SDK/LlmExecutor: execute module-design generation request through shared llm execution capability
- Execution/ImplementationGenerator -> SDK/LlmExecutor: execute implementation generation request through shared llm execution capability
- Contract/* -> SDK/LlmExecutor: execute llm-based contract-support request when a contract module needs shared llm capability
- Workflow/Pipeline -> Execution/RequirementGenerator: interpret raw requirement input
- Workflow/Pipeline -> Execution/ArchitectureDesignGenerator: generate architecture design output
- Workflow/Pipeline -> Execution/ModuleDesignGenerator: generate module design output
- Workflow/Pipeline -> Execution/ImplementationGenerator: generate intermediate resources, for example code, test cases, and config
- Workflow/Pipeline -> Contract/ValidationContract: check validation-stage output

#### 5.3.3 Check Stage Result

<!--
{
  "section_contract": {
    "section_id": "5.3.3",
    "title": "Check Stage Result",
    "checkitems": [
      "describe how stage results are checked",
      "connect workflow to contract modules explicitly"
    ],
    "severity": "medium",
    "expected_format": "- `{SourceA}` -> `{TargetA}`: `{PurposeA}`"
  }
}
-->

- Workflow/Pipeline -> Contract/RequirementContract: check requirement-stage input/output, report issues, and return the result for next-step decision
- Workflow/Pipeline -> Contract/ArchitectureDesignContract: check architecture-design-stage input/output, report issues, and return the result for the next-step decision
- Workflow/Pipeline -> Contract/ModuleDesignContract: check module-design-stage input/output, report issues, and return the result for the next-step decision
- Workflow/Pipeline -> Contract/ImplementationContract: check implementation-stage input/output, report issues, and return the result for the next-step decision

#### 5.3.4 Review And Decision

<!--
{
  "section_contract": {
    "section_id": "5.3.4",
    "title": "Review And Decision",
    "checkitems": [
      "describe review, reject, and apply interactions",
      "connect review decisions to stage progression semantics when relevant"
    ],
    "severity": "medium",
    "expected_format": "- `{SourceA}` -> `{TargetA}`: `{PurposeA}`"
  }
}
-->

- Workflow/Pipeline -> QualityGate/ChangeGate: for contract-enabled stages, submit stage results together with contract check results; for validation stage, submit validation success/failure result information directly for final review decision

#### 5.3.5 Store Artifact And History

<!--
{
  "section_contract": {
    "section_id": "5.3.5",
    "title": "Store Artifact And History",
    "checkitems": [
      "describe artifact and history persistence interactions",
      "keep the focus on architecture-level storage collaboration"
    ],
    "severity": "medium",
    "expected_format": "- `{SourceA}` -> `{TargetA}`: `{PurposeA}`\n- `{SourceB}` -> `{TargetB}`: `{PurposeB}`"
  }
}
-->

- Workflow/Pipeline -> QualityGate/Trace: notify important process information
- QualityGate/Trace -> Data/HistoryStore: save important process information
- Execution/* -> Data/ArtifactStore: save generated artifacts

### 5.4 Key Considerations

<!--
{
  "section_contract": {
    "section_id": "5.4",
    "title": "Key Considerations",
    "checkitems": [
      "capture important process, state, transition, quality, and consistency considerations",
      "keep the points architecture-relevant"
    ],
    "severity": "medium",
    "expected_format": "- `{ImportantConsideration1}`\n- `{ImportantConsideration2}`\n- `{ImportantConsideration3}`"
  }
}
-->

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

<!--
{
  "section_contract": {
    "section_id": "6",
    "title": "Non-Functional Considerations",
    "checkitems": [
      "deep-dive into the non-functional considerations that materially shape the architecture",
      "use concrete examples such as availability, scalability, and performance when relevant"
    ],
    "severity": "medium"
  }
}
-->

### 6.1 High Availability

<!--
{
  "section_contract": {
    "section_id": "6.1",
    "title": "High Availability",
    "checkitems": [
      "state why availability matters",
      "list only architectural support points that materially address availability"
    ],
    "severity": "medium",
    "expected_format": "- Why it matters:\n  - `{Reason1}`\n- Architectural support:\n  - `{Support1}`\n  - `{Support2}`"
  }
}
-->

- Why it matters:
  - The platform should remain available when part of the system fails.
- Architectural support:
  - Servers should support deployment on multiple machines to reduce single-point failure risk.
  - Services should be separated so part of the platform can still work when another part fails.
  - The platform should expose error information when system failure happens.

### 6.2 High Scalability

<!--
{
  "section_contract": {
    "section_id": "6.2",
    "title": "High Scalability",
    "checkitems": [
      "state why scalability matters",
      "list only architectural support points that materially address scalability"
    ],
    "severity": "medium",
    "expected_format": "- Why it matters:\n  - `{Reason1}`\n- Architectural support:\n  - `{Support1}`\n  - `{Support2}`"
  }
}
-->

- Why it matters:
  - The platform should support more tasks, scenarios, and user-defined rules in the future.
- Architectural support:
  - Workflow should support more task types in future stages.
  - Contract should support user-defined customization.

### 6.3 High Performance

<!--
{
  "section_contract": {
    "section_id": "6.3",
    "title": "High Performance",
    "checkitems": [
      "state why performance matters",
      "list only architectural support points that materially address performance"
    ],
    "severity": "medium",
    "expected_format": "- Why it matters:\n  - `{Reason1}`\n- Architectural support:\n  - `{Support1}`\n  - `{Support2}`"
  }
}
-->

- Why it matters:
  - The platform should reduce waiting time for generation and validation tasks.
- Architectural support:
  - Parallelization should be supported when possible, especially for design and implementation related execution units.

### 6.4 Technology Stack (Implementation Baseline)

This section defines system-level technology choices. Module documents should inherit this baseline and only add module-specific choices when necessary.

- Runtime and language:
  - Primary language: `TypeScript`
  - Runtime: `NodeJS`
- CLI and interaction:
  - CLI framework: `Python`
- LLM and agent execution:
  - Model provider SDK / gateway: `Gpt/DeepSeek/CladeCode`
- Data and persistence:
  - Artifact storage backend: `LocalFile`
  - History storage backend: `LocalFile`
- Validation and test:
  - Test framework / command strategy: `Python Shell`
- Build and dependency management:
  - Build toolchain: `Python Shell`
  - Package/dependency manager: `NPM`
- Deployment baseline:
  - Runtime topology baseline: 
    - Single-machine, single-process runtime for CLI
    - Remote cloud-hosted LLM provider for all model inference calls
  - Environment strategy (local/cloud): `Local`

Selection principles:

- Prefer proven and maintainable technologies for V1.
- Keep module boundaries stable when replacing implementation libraries.
- Global stack decisions should be recorded here first, then referenced by module design documents.

---

## 7. Design Documents

<!--
{
  "section_contract": {
    "section_id": "7",
    "title": "Design Documents",
    "checkitems": [
      "keep this section lightweight",
      "list only follow-up design documents that are really needed after this architecture document",
      "focus on document scope rather than module internals"
    ],
    "severity": "medium"
  }
}
-->

### 7.1 Design Document Categories

<!--
{
  "section_contract": {
    "section_id": "7.1",
    "title": "Design Document Categories",
    "checkitems": [
      "describe the main design-document categories and their focus",
      "keep the categories aligned with architecture boundaries"
    ],
    "severity": "medium",
    "expected_format": "Different design documents have different focus. All of them must still follow the module boundaries, dependency rules, and common stage pipeline defined in this architecture.\n\n- `{CategoryA}`\n- `{CategoryB}`\n- `{CategoryC}`"
  }
}
-->

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

<!--
{
  "section_contract": {
    "section_id": "7.2",
    "title": "Design Document Breakdown",
    "checkitems": [
      "break down follow-up design documents by major flow step or architecture area",
      "list each document with its intended scope"
    ],
    "severity": "medium"
  }
}
-->

Before reading the detailed breakdown, apply this three-layer structure:

- Layer 1 - Architecture document (`TechnicalArchitecture.md`): define system-level boundaries, dependency rules, and global workflow constraints.
- Layer 2 - System interaction document (`design_docs/SystemInteractionDesign.md`): define cross-module collaboration, interaction boundaries, and stage-level orchestration view.
- Layer 3 - Module design documents (`design_docs/*/*.md`): define module-local interfaces, runtime flow, and implementation-oriented details.

#### 7.2.1 Start Task

<!--
{
  "section_contract": {
    "section_id": "7.2.1",
    "title": "Start Task",
    "checkitems": [
      "list design documents needed for task start and workflow launch",
      "keep each item scoped to document responsibility"
    ],
    "severity": "medium",
    "expected_format": "- `{DesignDocA}`: `{ScopeA}`\n- `{DesignDocB}`: `{ScopeB}`"
  }
}
-->

- System Interaction Design: shared public APIs and request/response boundaries for cross-module calls.
- Interface/CLI Design: CLI-based task trigger and CLI interaction flow.
- Workflow/Pipeline Design: task start, stage selection, stage entry, and workflow control.

#### 7.2.2 Generate Or Update Stage Artifact

<!--
{
  "section_contract": {
    "section_id": "7.2.2",
    "title": "Generate Or Update Stage Artifact",
    "checkitems": [
      "list design documents needed for stage artifact generation or update",
      "cover relevant execution and data modules"
    ],
    "severity": "medium",
    "expected_format": "- `{DesignDocA}`: `{ScopeA}`\n- `{DesignDocB}`: `{ScopeB}`"
  }
}
-->

- Execution/RequirementGenerator Design: requirement interpretation logic and requirement-stage execution flow.
- Execution/ArchitectureDesignGenerator Design: architecture design generation logic and architecture-stage execution flow.
- Execution/ModuleDesignGenerator Design: module design generation logic and module-design-stage execution flow.
- Execution/ImplementationGenerator Design: implementation generation logic for code and test artifacts.
- Contract/ValidationContract Design: validation execution flow and validation result generation.
- Data/ArtifactStore Design: staged artifact storage and generated artifact persistence.

#### 7.2.3 Check Stage Result

<!--
{
  "section_contract": {
    "section_id": "7.2.3",
    "title": "Check Stage Result",
    "checkitems": [
      "list design documents needed for stage-result validation",
      "cover relevant contract modules"
    ],
    "severity": "medium",
    "expected_format": "- `{DesignDocA}`: `{ScopeA}`\n- `{DesignDocB}`: `{ScopeB}`"
  }
}
-->

- Contract/RequirementContract Design: requirement-stage input/output structure rules and validation contracts.
- Contract/ArchitectureDesignContract Design: architecture design input/output structure rules and validation contracts.
- Contract/ModuleDesignContract Design: module design input/output structure rules and validation contracts.
- Contract/ImplementationContract Design: implementation-stage input/output structure rules and validation contracts.

#### 7.2.4 Review And Decision

<!--
{
  "section_contract": {
    "section_id": "7.2.4",
    "title": "Review And Decision",
    "checkitems": [
      "list design documents needed for review and decision handling",
      "focus on quality-gate scope"
    ],
    "severity": "medium",
    "expected_format": "- `{DesignDocA}`: `{ScopeA}`"
  }
}
-->

- QualityGate/ChangeGate Design: review, reject, and apply decision handling for pending changes.

#### 7.2.5 Store Artifact And History

<!--
{
  "section_contract": {
    "section_id": "7.2.5",
    "title": "Store Artifact And History",
    "checkitems": [
      "list design documents needed for artifact storage and history recording",
      "cover both accepted artifacts and process records"
    ],
    "severity": "medium",
    "expected_format": "- `{DesignDocA}`: `{ScopeA}`\n- `{DesignDocB}`: `{ScopeB}`"
  }
}
-->

- QualityGate/Trace Design: review status tracking, pending review visibility, and important progress information.
- Data/ArtifactStore Design: accepted artifact storage and downstream artifact lookup.
- Data/HistoryStore Design: workflow history, operation records, and process trace storage.

---

## 8. Open Issues

<!--
{
  "section_contract": {
    "section_id": "8",
    "title": "Open Issues",
    "checkitems": [
      "record unresolved questions, risks, or assumptions that still require clarification",
      "include only unresolved items that may affect architecture decisions",
      "separate real open issues from minor implementation details"
    ],
    "severity": "medium",
    "expected_format": "- `{OpenIssue1}`\n- `{OpenIssue2}`\n- `{RiskOrAssumption1}`"
  }
}
-->

---
