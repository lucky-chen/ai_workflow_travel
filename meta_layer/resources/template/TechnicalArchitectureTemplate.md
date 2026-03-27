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
      "state the layer dependency law explicitly: upper layers may depend on lower layers, same-layer modules may depend on each other, and lower layers must not depend on upper layers",
      "keep the rules aligned with the defined layers or partitions"
    ],
    "severity": "medium",
    "expected_format": "Rules:\n- upper layers may depend on lower layers\n- same-layer modules may depend on each other\n- lower layers must not depend on upper layers\n\nALLOW:\n- `{SourceA}` -> `{TargetA}`\n- `{SourceB}` -> `{TargetB}`\n- `{SourceC}` -> `{TargetC}`"
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
      "keep the diagram high level and readable",
      "use a boxed layered architecture diagram in plain text",
      "show top-down layer progression and major dependency direction"
    ],
    "severity": "medium",
    "expected_format": "```text\n+------------------+\n|     Layer A      |\n|  role summary    |\n+------------------+\n      |\n      v\n+------------------+\n|     Layer B      |\n|  role summary    |\n+------------------+\n      |\n      v\n+------------------------------+\n|           Layer C            |\n| sub-part A / sub-part B      |\n+------------------------------+\n      |          \\\\          \\\\\n      v           v           v\n+----------+   +----------+   +----------+\n| Layer D  |   | Layer E  |   | Layer F  |\n+----------+   +----------+   +----------+\n```\n\nThe diagram must use boxed text blocks like the example above. Do not use bullet-tree diagrams for this section."
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
      "identify gateways, retries, asynchronous handoffs, approvals, or other control points where relevant",
      "the main path must cover every architecture layer that participates in the primary path and must not skip required intermediate layers",
      "all key boundaries that participate in the primary path must be shown explicitly in both the diagram and the textual steps",
      "the textual steps must stay consistent with the diagram and must not assign responsibilities to a layer that are owned by another layer"
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
      "module names must not contain spaces",
      "keep the notes lightweight and architecture-oriented",
      "keep the field structure consistent within the section when optional fields are used",
      "do not split this section into an additional mandatory module-capabilities subsection"
    ],
    "severity": "medium",
    "expected_format": "This section may be organized by architecture layer or partition when that improves readability.\n\n- **`LayerOrPartitionA`**\n  - `ModuleA`\n    - responsibility: `{ResponsibilityA}`\n    - inputs: `{InputBoundaryA}`\n    - outputs: `{OutputBoundaryA}`\n    - ownership boundary: `{OwnershipBoundaryA}`\n  - `ModuleB`\n    - responsibility: `{ResponsibilityB}`\n    - inputs: `{InputBoundaryB}`\n    - outputs: `{OutputBoundaryB}`\n\n- **`LayerOrPartitionB`**\n  - `ModuleC`\n    - responsibility: `{ResponsibilityC}`"
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
      "keep this section at cross-module interaction level rather than module-internal detail",
      "for each 5.3.x scenario, include one mandatory UML interaction diagram",
      "the UML for each scenario must be a core-module interaction diagram rather than a layer-level interaction diagram",
      "the UML must stay at architecture boundary level and must not expand into API field or storage schema detail",
      "for each scenario, make user scenario and InteractionGoal explicit",
      "when multiple scenarios exist, each scenario must carry its own UML instead of relying on one section-level shared UML",
      "each 5.3.x scenario UML must show one complete interaction backbone from scenario entry to scenario exit",
      "each 5.3.x scenario UML must include all architecture-defined modules or boundaries that participate in that scenario backbone",
      "each scenario UML must not introduce modules or responsibilities that are not defined in the architecture layers and core modules sections",
      "related 5.3.x scenarios should keep consistent interaction granularity and notation"
    ],
    "severity": "medium",
    "expected_format": "This section describes high-level cross-module interaction.\n\nWhen the system evolves in stages or has multiple major user scenarios, organize the section by scenario:\n\n#### 5.3.x `{ScenarioName}`\n- user scenario: `{UserScenario}`\n  - InteractionGoal: `{InteractionGoal}`\n\n```plantuml\n@startuml\n{CoreModuleInteractionDiagramForScenarioX}\n@enduml\n```"
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
        "output this section as a design-document directory view",
        "list follow-up design documents that map directly to the modules identified in the architecture document",
        "include dedicated design documents for key cross-module interactions when the architecture document identifies them",
        "state each document path together with its type, intended scope, and included items",
        "use markdown link format as [document_name](document_path)",
        "document_name must not contain spaces",
        "prefer stable lowercase snake_case or other repository-standard identifiers",
        "keep document names aligned with module or interaction identifiers when practical",
        "the document directory should correspond to the modules and key interactions explicitly listed in the architecture document",
        "allowed document types are functional_group_design, test_design, reference_design, and protocol_design"
      ],
      "severity": "high",
      "expected_format": "- [document_name_a](./breakdown_docs/document_name_a.md)\n  - type: `{DocumentTypeA}`\n  - scope: `{DocumentFunctionA}`\n  - include: `{IncludedItemA}`, `{IncludedItemB}`\n\n- [document_name_b](./breakdown_docs/document_name_b.md)\n  - type: `{DocumentTypeB}`\n  - scope: `{DocumentFunctionB}`\n  - include: `{IncludedItemC}`, `{IncludedItemD}`\n\n- [document_name_c](./breakdown_docs/document_name_c.md)\n  - type: `{DocumentTypeC}`\n  - scope: `{DocumentFunctionC}`\n  - include: `{IncludedItemE}`, `{IncludedItemF}`"
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
