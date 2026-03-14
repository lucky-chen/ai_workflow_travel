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
      "description": "Architecture style, dependency rules, runtime interactions, design document breakdown, and open issues should remain logically consistent across sections.",
      "severity": "high"
    },
    {
      "check_item": "architecture_level_boundary",
      "description": "The document must stay at architecture level. Detailed API fields, prompt wording, storage schema, and module-internal retry or algorithm logic should be moved to follow-up design documents.",
      "severity": "high"
    },
    {
      "check_item": "interaction_structure_clarity",
      "description": "Primary Interaction Path should describe the reusable backbone. Interaction Model may expand by scenario or stage, but each scenario must stay focused on module collaboration, control handoff, and ownership boundaries.",
      "severity": "medium"
    },
    {
      "check_item": "scope_stage_clarity",
      "description": "If future-stage capabilities are mentioned, they must be explicitly labeled so readers can distinguish target architecture from current delivery scope.",
      "severity": "medium"
    },
    {
      "check_item": "design_doc_derivation",
      "description": "Core Modules should list only architecture-relevant modules, and follow-up design documents should be derived from the architecture rather than copied from an existing folder tree.",
      "severity": "medium"
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

## 2. Scope

<!--
{
  "section_contract": {
    "section_id": "2",
    "title": "Scope",
    "checkitems": [
      "define what this document covers",
      "define what this document does not cover",
      "clarify the boundary between overall architecture and follow-up design documents"
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
      "focus on major runtime interactions, major modules, boundaries, and key constraints"
    ],
    "severity": "medium",
    "expected_format": "- Overall system interaction and control flow at architecture level.\n- Major modules or subsystems and their responsibilities at architecture level.\n- Collaboration boundaries and dependency direction between major parts of the system.\n- Key architecture constraints related to reliability, operability, security, scalability, or evolution."
  }
}
-->

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
    "expected_format": "- Detailed module internals and implementation logic.\n- Detailed API contracts, message formats, and parameter definitions inside each module.\n- Database schema details and storage-level design.\n- UI-level interaction design and visual behavior details.\n- Deployment runbooks, environment setup, and operational procedures.\n\nCross-module interaction contracts are covered at a lightweight shared-boundary level in a separate design document, not in full module-level detail here."
  }
}
-->

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

---

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

### 4.5 Runtime Topology

<!--
{
  "section_contract": {
    "section_id": "4.5",
    "title": "Runtime Topology",
    "checkitems": [
      "describe the runtime view in a lightweight way",
      "clarify which major parts run together, which parts may be separated, and how shared resources are used",
      "keep the content at topology level rather than operational detail"
    ],
    "severity": "medium",
    "expected_format": "- `{RuntimePartA}`: `{RoleA}`\n- `{RuntimePartB}`: `{RoleB}`\n- `{SharedPart}`: `{RoleC}`"
  }
}
-->

### 4.6 Technology Choices

<!--
{
  "section_contract": {
    "section_id": "4.6",
    "title": "Technology Choices",
    "checkitems": [
      "state the implementation technology choices for each major layer, partition, or module",
      "keep the description at technology-stack selection level rather than implementation detail",
      "make the mapping between architecture parts and technology choices explicit"
    ],
    "severity": "medium",
    "expected_format": "- `{LayerOrModuleA}`: `{TechStackA}` for `{WhyOrResponsibilityA}`\n- `{LayerOrModuleB}`: `{TechStackB}` for `{WhyOrResponsibilityB}`\n- `{LayerOrModuleC}`: `{TechStackC}` for `{WhyOrResponsibilityC}`"
  }
}
-->

---

## 5. System Interactions

<!--
{
  "section_contract": {
    "section_id": "5",
    "title": "System Interactions",
    "checkitems": [
      "describe only the runtime interactions needed to understand the system behavior",
      "focus on module collaboration, primary interaction paths, and control points rather than module internals",
      "make the primary interaction path explicit"
    ],
    "severity": "medium"
  }
}
-->

### 5.1 Primary Interaction Path

<!--
{
  "section_contract": {
    "section_id": "5.1",
    "title": "Primary Interaction Path",
    "checkitems": [
      "make the main execution, request, or event path explicit",
      "show the reusable control shape across the main interaction path",
      "identify gateways, retries, asynchronous handoffs, approvals, or other control points where relevant"
    ],
    "severity": "medium",
    "expected_format": "```text\n[Main flow diagram here]\n```\n\n1. `{Step1}`\n2. `{Step2}`\n3. `{Step3}`\n\n`{FlowSummary}`"
  }
}
-->

### 5.2 Core Modules

<!--
{
  "section_contract": {
    "section_id": "5.2",
    "title": "Core Modules",
    "checkitems": [
      "list only the modules needed to understand the architecture",
      "group modules in a way that stays aligned with the architecture partitions when useful",
      "keep each module description at architecture level and focus on responsibility, boundary, and collaboration role",
      "allow lightweight notes on key inputs, outputs, or ownership boundaries only when they help explain the architecture",
      "module names must use English identifiers only",
      "module names must start with an uppercase letter",
      "module names must not contain spaces"
    ],
    "severity": "medium",
    "expected_format": "This section may be organized by architecture layer or partition when that improves readability.\n\n- **`LayerOrPartitionA`**\n  - `ModuleA`\n    - responsibility: `{ResponsibilityA}`\n    - inputs: `{InputBoundaryA}`\n    - outputs: `{OutputBoundaryA}`\n    - ownership boundary: `{OwnershipBoundaryA}`\n  - `ModuleB`\n    - responsibility: `{ResponsibilityB}`\n    - inputs: `{InputBoundaryB}`\n    - outputs: `{OutputBoundaryB}`\n\n- **`LayerOrPartitionB`**\n  - `ModuleC`\n    - responsibility: `{ResponsibilityC}`\n\nKeep the notes lightweight and architecture-oriented. Not every module needs every field, but the structure should stay consistent within the section. Do not split this section into an additional mandatory module-capabilities subsection."
  }
}
-->

### 5.3 Interaction Model

<!--
{
  "section_contract": {
    "section_id": "5.3",
    "title": "Interaction Model",
    "checkitems": [
      "explain how modules collaborate at a high level",
      "group interactions by major interaction step, user scenario, or control point",
      "make it clear which interactions belong to the current mainline and which are future-stage extensions when relevant",
      "keep this section at cross-module interaction level rather than module-internal detail"
    ],
    "severity": "medium",
    "expected_format": "This section describes high-level cross-module interaction. The concrete public APIs or interface contracts for these calls are defined in `{CrossModuleDocPath}`.\n\nWhen the system evolves in stages or has multiple major user scenarios, organize the section in two main steps:\n\n#### 5.3.x `{ScenarioName}`\n- user scenario: `{UserScenario}`\n- stage position: `{CurrentScopeOrFutureStage}`\n- goal: `{InteractionGoal}`\n\nUnder each `5.3.x` scenario, expand into concrete interaction cases:\n\n##### 5.3.x.x `{InteractionCaseName}`\n- summary: `{WhatThisInteractionCaseCovers}`\n- modules involved: `{ModuleA}`, `{ModuleB}`, `{ModuleC}`\n- control focus: `{RoutingOrApprovalOrAsyncBoundary}`\n\nWithin each `5.3.x.x` interaction case, continue to deeper levels only when needed for readability. The deepest useful level should typically be one of these structures:\n\n```plantuml\n@startuml\nactor User\nparticipant ModuleA\nparticipant ModuleB\nUser -> ModuleA: `{Action}`\nModuleA -> ModuleB: `{Delegation}`\nModuleB -> ModuleA: `{Result}`\n@enduml\n```\n\n```text\n{METHOD} {PATH} => request { `{RequestShape}` } => response { `{ResponseShape}` }\n```\n\nUse `plantuml` for cross-module interaction views and `text` for lightweight public API or shared interface shapes. These views should capture only the shared boundary and collaboration path that matter at architecture level.\n\nFor each scenario, prefer this information order:\n- user scenario or trigger\n- current stage versus future-stage position\n- interaction goal\n- interaction cases under `5.3.x.x`\n- lightweight shared interaction shape when needed\n\nDo not include detailed request fields, storage schema, or module-internal algorithms here."
  }
}
-->

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
    "expected_format": "Different design documents have different focus. All of them must still follow the module boundaries, dependency rules, and shared architectural constraints defined in this architecture.\n\n- `{CategoryA}`\n- `{CategoryB}`\n- `{CategoryC}`\n\nTypical categories may include execution-unit design documents, cross-module interaction documents, shared contract documents, and runtime or data-boundary documents."
  }
}
-->

### 7.2 Design Document Breakdown

<!--
{
    "section_contract": {
      "section_id": "7.2",
      "title": "Design Document Breakdown",
      "checkitems": [
        "output this section as a document directory list",
        "list follow-up design documents that map directly to the modules identified in the architecture document",
        "include dedicated design documents for key cross-module interactions when the architecture document identifies them",
        "state each document path together with its intended scope",
        "use markdown link format as [document_name](document_path)",
        "document_name must not contain spaces"
      ],
      "severity": "high",
      "expected_format": "- [document_name_a](./design_docs/document_name_a.md): covers `{ModuleOrInteractionA}`.\n- [document_name_b](./design_docs/document_name_b.md): covers `{ModuleOrInteractionB}`.\n- [document_name_c](./design_docs/document_name_c.md): covers `{ModuleOrInteractionC}`.\n\nThe document directory should correspond to the modules and key interactions explicitly listed in the architecture document.\n\nDocument naming rules:\n- use markdown link format [document_name](document_path)\n- document_name must not contain spaces\n- prefer stable lowercase snake_case or other repository-standard identifiers\n- keep document names aligned with module or interaction identifiers when practical\n\nThe breakdown should prefer stable architecture-aligned slices, for example:\n- one document per major module or subsystem when that module has meaningful internal design work\n- one document for a repeated cross-module interaction pattern when multiple modules rely on the same collaboration shape\n- one document for shared contracts when multiple modules depend on the same canonical structure"
    }
}
-->

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
