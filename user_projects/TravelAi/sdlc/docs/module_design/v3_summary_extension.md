<!--
{
  "document_contracts": [
    {
      "check_item": "document_structure_complete",
      "description": "The document should contain the required top-level sections and expected subsection structure.",
      "severity": "high"
    },
    {
      "check_item": "section_contract_alignment",
      "description": "Each major section should be described by an explicit SectionContract-style comment including section_id, title, expected_format, and hints.",
      "severity": "high"
    },
    {
      "check_item": "format_consistency",
      "description": "The document should keep section formatting, code-block style, and terminology consistent across all sections.",
      "severity": "medium"
    }
  ]
}
-->

# V3SummaryExtension Design

## 1. Goal

### 1.1 Purpose

<!--
{
  "section_contract": {
    "section_id": "1.1",
    "title": "Purpose",
    "checkitems": [
      "define the purpose of the current module design document",
      "make the module boundary explicit"
    ],
    "severity": "medium",
    "expected_format": "`{Purpose}`"
  }
}
-->

定义 `V3SummaryExtension` 如何基于当前计划与 `TripRecord` 生成轻量总结结果和后续 action，聚焦扩展接入边界，不展开具体总结文案策略。

### 1.2 Involved Modules

<!--
{
  "section_contract": {
    "section_id": "1.2",
    "title": "Involved Modules",
    "checkitems": [
      "list the directly involved module",
      "list the collaborating modules only when they are necessary for understanding the design"
    ],
    "severity": "medium",
    "expected_format": "This module design directly involves:\n\n- `{ModulePath}`\n\nThis module design collaborates with:\n\n- `{CollaboratorA}`\n- `{CollaboratorB}`"
  }
}
-->

This module design directly involves:

- `./module_design/v3_summary_extension.md`

This module design collaborates with:

- `./module_design/trip_record_service.md`
- `./module_design/trip_repository.md`
- `./module_design/action_service.md`
- `./module_design/experience_layer.md`

### 1.3 Core Functions

<!--
{
  "section_contract": {
    "section_id": "1.3",
    "title": "Core Functions",
    "checkitems": [
      "summarize the module role",
      "list the core functions only",
      "explicitly state what is out of scope for this module"
    ],
    "severity": "medium",
    "expected_format": "`{ModulePath}` is the `{ModuleRole}` module.\n\nIts core functions are:\n\n- `{CoreFunction1}`\n- `{CoreFunction2}`\n- `{CoreFunction3}`\n- `{CoreFunction4}`\n\n`{ModuleName}` does not `{OutOfScope1}`, `{OutOfScope2}`, or `{OutOfScope3}`."
  }
}
-->

`V3SummaryExtension` is the post-trip summary generation and follow-up action extension module.

Its core functions are:

- read current plan and historical trip records for a completed trip
- generate lightweight summary content and recap structure
- produce optional follow-up actions for review,整理, or export-like next steps
- return summary results without changing the current-plan ownership model

`V3SummaryExtension` does not own trip-record storage, execute follow-up actions, or store raw media assets.

## 2. Core Classes

<!--
{
  "section_contract": {
    "section_id": "2",
    "title": "Core Classes",
    "checkitems": [
      "this section must be expressed using UML class diagram language",
      "do not replace the class diagram with prose-only description"
    ],
    "severity": "medium"
  }
}
-->

### 2.1 Class Diagram

<!--
{
  "section_contract": {
    "section_id": "2.1",
    "title": "Class Diagram",
    "checkitems": [
      "show the important classes, interfaces, and dependencies",
      "keep the diagram focused on core module structure"
    ],
    "severity": "medium",
    "expected_format": "```plantuml\n' UML class diagram here\n```"
  }
}
-->

```plantuml
@startuml
interface IV3SummaryExtension {
  +generate(input: SummaryGenerationInput): SummaryGenerationOutput
}

class V3SummaryExtension
class SummaryContextLoader
class SummaryComposer
class FollowUpActionProjector

interface ITripRepository
interface IActionService

IV3SummaryExtension <|.. V3SummaryExtension
V3SummaryExtension --> SummaryContextLoader
V3SummaryExtension --> SummaryComposer
V3SummaryExtension --> FollowUpActionProjector
SummaryContextLoader --> ITripRepository
FollowUpActionProjector --> IActionService
@enduml
```

### 2.2 Core Class Responsibilities

<!--
{
  "section_contract": {
    "section_id": "2.2",
    "title": "Core Class Responsibilities",
    "checkitems": [
      "describe the role and responsibilities of the key classes or interfaces shown in the class diagram",
      "keep one subsection per important class, interface, or component",
      "do not restate every field unless it affects responsibilities or boundaries"
    ],
    "severity": "medium",
    "expected_format": "### 2.2 `PrimaryService`\n\nRole:\n\n- `{PrimaryRole}`\n\nResponsibilities:\n\n- `{Responsibility1}`\n- `{Responsibility2}`\n- `{Responsibility3}`"
  }
}
-->

### 2.2 `V3SummaryExtension`

Role:

- summary-generation facade for post-trip recap

Responsibilities:

- coordinate context loading, summary composition, and follow-up projection
- expose a stable summary-generation API to the application layer
- keep summary generation separate from trip-record building and persistence

### 2.2 `SummaryContextLoader`

Role:

- summary input loader

Responsibilities:

- load current plan and trip record history from `TripRepository`
- provide a stable generation context for summary composition
- isolate repository reads from summary composition logic

### 2.2 `SummaryComposer`

Role:

- lightweight recap builder

Responsibilities:

- organize trip highlights, changes, and review content into a summary structure
- keep output lightweight and based on recorded history
- avoid becoming a full narrative-authoring subsystem

## 3. Core Runtime Flow

<!--
{
  "section_contract": {
    "section_id": "3",
    "title": "Core Runtime Flow",
    "checkitems": [
      "this section must be expressed using UML sequence diagram language",
      "the diagram should focus on core runtime interactions between the module and its collaborators"
    ],
    "severity": "medium"
  }
}
-->

### 3.1 Main Sequence Diagram

<!--
{
  "section_contract": {
    "section_id": "3.1",
    "title": "Main Sequence Diagram",
    "checkitems": [
      "show the main runtime interaction between the initiating actor, the module, and its collaborators",
      "keep the flow focused on the primary success path"
    ],
    "severity": "medium",
    "expected_format": "```plantuml\n' UML sequence diagram here\n```"
  }
}
-->

```plantuml
@startuml
actor TripApplicationService
participant V3SummaryExtension
participant TripRepository
participant SummaryComposer
participant ActionService

TripApplicationService -> V3SummaryExtension: generate(summaryGenerationInput)
V3SummaryExtension -> TripRepository: loadPlanContext(planContextQuery)
TripRepository --> V3SummaryExtension: currentPlan + tripRecords
V3SummaryExtension -> SummaryComposer: compose(summaryContext)
SummaryComposer --> V3SummaryExtension: summary
V3SummaryExtension -> ActionService: project(actionProjectionInput)
ActionService --> V3SummaryExtension: followUpActionBundle
V3SummaryExtension --> TripApplicationService: summaryGenerationOutput
@enduml
```

## 4. Detailed Design

### 4.1 Core APIs And Fields

<!--
{
  "section_contract": {
    "section_id": "4.1",
    "title": "Core APIs And Fields",
    "checkitems": [
      "define only stable interfaces and types needed to understand the module",
      "prefer concise and implementation-oriented type definitions"
    ],
    "severity": "medium"
  }
}
-->

#### 4.1.1 Public API

<!--
{
  "section_contract": {
    "section_id": "4.1.1",
    "title": "Public API",
    "checkitems": [
      "define only the public API that upstream modules need to call",
      "keep the API structure stable and minimal"
    ],
    "severity": "medium",
    "expected_format": "```typescript\ninterface I{ModuleName} {\n  {PublicMethod}({PrimaryInputName}: {PrimaryInputType}): {PrimaryOutputType}\n}\n```"
  }
}
-->

```typescript
interface IV3SummaryExtension {
  generate(input: SummaryGenerationInput): Promise<SummaryGenerationOutput>
}
```

#### 4.1.2 Input Types

<!--
{
  "section_contract": {
    "section_id": "4.1.2",
    "title": "Input Types",
    "checkitems": [
      "define only input structures that belong to this module",
      "do not repeat upstream shared types unless this module owns them",
      "when the module contains contract-style section definitions, prefer stable names such as `document_contracts` and `section_contracts`",
      "input format must be defined explicitly in code blocks",
      "do not use natural-language prose to describe input structure"
    ],
    "severity": "medium",
    "expected_format": "```typescript\ninterface {PrimaryInputType} {\n  {InputFieldA}: {InputFieldTypeA}\n  {InputFieldB}?: {InputFieldTypeB}\n}\n\ninterface ContractSpec {\n  document_contracts: DocumentContract[]\n  section_contracts: SectionContract[]\n}\n```\n\nNo prose outside code blocks."
  }
}
-->

```typescript
interface SummaryGenerationInput {
  tripId: string
  username: string
  includeMediaIndex?: boolean
  includeExpenseReview?: boolean
  includePostTripActions?: boolean
}
```

#### 4.1.3 Runtime Types

<!--
{
  "section_contract": {
    "section_id": "4.1.3",
    "title": "Runtime Types",
    "checkitems": [
      "define internal runtime structures only when they are necessary for understanding the design",
      "keep runtime types implementation-oriented but concise"
    ],
    "severity": "medium",
    "expected_format": "```typescript\ninterface {RuntimeTypeA} {\n  {RuntimeFieldA}: {RuntimeFieldTypeA}\n}\n\ninterface {RuntimeTypeB} {\n  {RuntimeFieldB}: {RuntimeFieldTypeB}\n}\n```"
  }
}
-->

```typescript
interface SummaryContext {
  tripId: string
  currentPlan: Record<string, unknown>
  tripRecords: Record<string, unknown>[]
}

interface ComposedSummary {
  title: string
  sections: Record<string, unknown>[]
}
```

#### 4.1.4 Output Types

<!--
{
  "section_contract": {
    "section_id": "4.1.4",
    "title": "Output Types",
    "checkitems": [
      "define the stable output structure produced by this module",
      "make downstream-consumed fields explicit",
      "output format must be defined explicitly in code blocks",
      "do not use natural-language prose to describe output structure"
    ],
    "severity": "medium",
    "expected_format": "```typescript\ninterface {PrimaryOutputType} {\n  {OutputFieldA}: {OutputFieldTypeA}\n  {OutputFieldB}?: {OutputFieldTypeB}\n}\n```\n\nNo prose outside code blocks."
  }
}
-->

```typescript
interface SummaryGenerationOutput {
  tripId: string
  summary: Record<string, unknown>
  followUpActions?: Record<string, unknown>[]
  generatedAt: string
}
```

#### 4.1.5 Module-Specific Rules

<!--
{
  "section_contract": {
    "section_id": "4.1.5",
    "title": "Module-Specific Rules",
    "checkitems": [
      "add this subsection only when the module has important transformation, validation, mapping, or request-construction rules",
      "express stable rules that downstream modules depend on",
      "prefer bullets over long prose"
    ],
    "severity": "medium",
    "expected_format": "- `{Rule1}`\n- `{Rule2}`\n- `{Rule3}`"
  }
}
-->

- `V3SummaryExtension` only reads current plan and trip-record history; it does not mutate the current plan.
- Summary output must be grounded in persisted records and current plan state, not raw provider payloads.
- Follow-up actions are optional derived outputs and do not imply automatic execution.
- Media support is index-based only and cannot assume raw media storage.

### 4.2 Constraints

<!--
{
  "section_contract": {
    "section_id": "4.2",
    "title": "Constraints",
    "checkitems": [
      "record the key module constraints and non-goals",
      "include runtime semantics here when needed",
      "avoid implementation trivia"
    ],
    "severity": "medium",
    "expected_format": "- `{Constraint1}`\n- `{Constraint2}`\n- `{Constraint3}`\n- `{Constraint4}`"
  }
}
-->

- `V3SummaryExtension` is an optional extension layer and must not alter V1/V2 core planning boundaries.
- The module depends on the quality of persisted `TripRecord` data and should not invent unsupported historical detail.
- Summary generation remains lightweight and does not aim to replace a full content-editing workflow.
- Long-term archive/export storage decisions remain outside this module design document.
