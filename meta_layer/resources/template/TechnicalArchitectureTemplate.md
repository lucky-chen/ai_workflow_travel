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
      "describe the backend runtime and deployment view in a lightweight way",
      "clarify which major parts run together, which parts may be separated, and how shared storage is used",
      "keep the content at runtime topology level rather than deployment runbook detail"
    ],
    "severity": "medium",
    "expected_format": "- `{RuntimeNodeA}`: `{ResponsibilityA}`\n- `{RuntimeNodeB}`: `{ResponsibilityB}`\n- `{SharedInfrastructure}`: `{ResponsibilityC}`"
  }
}
-->

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
    "expected_format": "Different design documents have different focus. All of them must still follow the module boundaries, dependency rules, and common stage pipeline defined in this architecture.\n\n- `{CategoryA}`\n- `{CategoryB}`\n- `{CategoryC}`"
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
      "break down follow-up design documents by major flow step or architecture area",
      "list each document with its intended scope"
    ],
    "severity": "medium"
  }
}
-->

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
