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

# TripRepository Design

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

定义 `TripRepository` 作为统一持久化与读取组装边界的职责、输入输出和约束，明确其不承载业务决策、派生计算和流程编排。

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

- `./module_design/trip_repository.md`

This module design collaborates with:

- `./module_design/plan_service.md`
- `./module_design/schedule_service.md`
- `./module_design/trip_record_service.md`

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

`TripRepository` is the trip aggregate persistence and read-assembly boundary module.

Its core functions are:

- read current trip context and current effective plan by trip and username scope
- commit unified write payloads produced by `PlanService` or `ScheduleService`
- assemble persisted `plan`, `action`, `entryInfo`, and `TripRecord` data into stable read models
- support read access for current plan, trip state, and record-oriented downstream consumers

`TripRepository` does not generate business data, validate domain rules, or decide what should be written.

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
interface ITripRepository {
  +loadPlanContext(query: PlanContextQuery): PlanContextRecord
  +commitPlanChange(payload: TripCommitPayload): PersistedPlanRecord
  +commitScheduleChange(payload: TripCommitPayload): PersistedPlanRecord
  +updateActionBundle(payload: ActionBundleUpdate): PersistedPlanRecord
  +appendTripRecord(payload: TripRecordAppend): void
}

class TripRepository
class TripStateStore
class PlanStore
class ActionStore
class TripRecordStore
class PlanReadAssembler

ITripRepository <|.. TripRepository
TripRepository --> TripStateStore
TripRepository --> PlanStore
TripRepository --> ActionStore
TripRepository --> TripRecordStore
TripRepository --> PlanReadAssembler
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

### 2.2 `TripRepository`

Role:

- persistence facade for trip aggregate reads and writes

Responsibilities:

- accept only already-decided commit payloads from submit owners
- coordinate storage-layer writes for plan, action, entryInfo, and tripRecord data
- expose stable read models back to callers

### 2.2 `PlanReadAssembler`

Role:

- read-model assembler for current plan shape

Responsibilities:

- combine persisted plan, action, and entry info records
- emit a single logical current-plan result to upstream modules
- keep read assembly logic out of business services

### 2.2 `TripRecordStore`

Role:

- durable record append and lookup component

Responsibilities:

- persist change records associated with trip updates
- expose record reads for V3 summary and history-oriented views
- keep record storage separate from plan mutation decisions

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
actor PlanService
participant TripRepository
participant PlanStore
participant ActionStore
participant TripRecordStore
participant PlanReadAssembler

PlanService -> TripRepository: commitPlanChange(tripCommitPayload)
TripRepository -> PlanStore: savePlan(planData)
TripRepository -> ActionStore: saveActionBundle(actionBundle)
TripRepository -> TripRecordStore: appendTripRecord(tripRecord)
TripRepository -> PlanReadAssembler: assembleCurrentPlan(tripId, username)
PlanReadAssembler --> TripRepository: persistedPlanRecord
TripRepository --> PlanService: persistedPlanRecord
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
interface ITripRepository {
  loadPlanContext(query: PlanContextQuery): Promise<PlanContextRecord>
  commitPlanChange(payload: TripCommitPayload): Promise<PersistedPlanRecord>
  commitScheduleChange(payload: TripCommitPayload): Promise<PersistedPlanRecord>
  updateActionBundle(payload: ActionBundleUpdate): Promise<PersistedPlanRecord>
  appendTripRecord(payload: TripRecordAppend): Promise<void>
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
interface PlanContextQuery {
  tripId: string
  username: string
  targetDays?: string[]
}

interface TripCommitPayload {
  tripId: string
  username: string
  plan: Record<string, unknown>
  actionBundle: Record<string, unknown>
  tripRecord: Record<string, unknown>
}

interface ActionBundleUpdate {
  tripId: string
  username: string
  actionBundle: Record<string, unknown>
}

interface TripRecordAppend {
  tripId: string
  username: string
  tripRecord: Record<string, unknown>
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
interface PlanContextRecord {
  tripId: string
  username: string
  tripContext: Record<string, unknown>
  currentPlan?: Record<string, unknown>
}

interface PersistedPlanRecord {
  tripId: string
  username: string
  plan: Record<string, unknown>
  updatedAt: string
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
interface CurrentPlanReadModel {
  tripId: string
  username: string
  plan: Record<string, unknown>
  tripRecord?: Record<string, unknown>[]
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

- `TripRepository` accepts only fully assembled write payloads from submit owners.
- Repository methods must enforce username ownership on both reads and writes.
- Read assembly may combine multiple stored records, but it must not derive new business meaning.
- Runtime provider cache is not part of the persistence contract.

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

- `TripRepository` is a persistence boundary, not an orchestration boundary.
- The repository must preserve the single current effective plan model rather than version-history comparison flows.
- The repository does not define action, entry, or trip-record semantics; it stores submitted structures.
- Storage-engine optimization, indexing, and physical schema tuning remain outside this module design document.
