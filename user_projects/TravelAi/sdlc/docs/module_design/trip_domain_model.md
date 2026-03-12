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

# TripDomainModel Design

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

定义 `TripDomainModel` 的核心业务对象和合法性判断边界，说明哪些约束属于领域判断，哪些不属于领域模型职责。

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

- `./module_design/trip_domain_model.md`

This module design collaborates with:

- `./module_design/plan_service.md`
- `./module_design/schedule_service.md`
- `./module_design/plan_normalizer.md`
- `./module_design/provider_hub.md`

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

`TripDomainModel` is the trip-domain object and rule-validation module.

Its core functions are:

- define the stable business objects used across planning, schedule, action, and record flows
- validate budget, pace, route coherence, and executability constraints over normalized plans
- return explicit rule failures that upstream modules can use for repair loops
- keep domain semantics independent from UI and provider payload formats

`TripDomainModel` does not call external providers, persist data, or generate final plans by itself.

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
class Trip
class Plan
class DaySchedule
class ActionItem
class ChangeRequest
class TripRecord
class TripDomainModel
class PlanRuleEvaluator
class BudgetPolicy
class PacePolicy
class RouteCoherencePolicy

TripDomainModel --> Trip
TripDomainModel --> Plan
TripDomainModel --> DaySchedule
TripDomainModel --> ActionItem
TripDomainModel --> ChangeRequest
TripDomainModel --> TripRecord
TripDomainModel --> PlanRuleEvaluator
PlanRuleEvaluator --> BudgetPolicy
PlanRuleEvaluator --> PacePolicy
PlanRuleEvaluator --> RouteCoherencePolicy
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

### 2.2 `TripDomainModel`

Role:

- domain validation facade for core trip business rules

Responsibilities:

- evaluate normalized plans against stable business constraints
- expose explicit validation failures for repair loops
- preserve a stable set of business concepts across modules

### 2.2 `PlanRuleEvaluator`

Role:

- composed plan-rule execution component

Responsibilities:

- run budget, pace, and route coherence checks
- merge rule results into a single validation outcome
- isolate policy execution from transport and persistence concerns

### 2.2 `BudgetPolicy`

Role:

- budget guard component

Responsibilities:

- compare plan cost shape against declared budget expectations
- flag missing, excessive, or inconsistent spending assumptions
- keep budget rules independent from provider-specific pricing payloads

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
participant TripDomainModel
participant PlanRuleEvaluator
participant BudgetPolicy
participant PacePolicy
participant RouteCoherencePolicy

PlanService -> TripDomainModel: validatePlan(normalizedPlan)
TripDomainModel -> PlanRuleEvaluator: evaluate(normalizedPlan)
PlanRuleEvaluator -> BudgetPolicy: check(normalizedPlan)
BudgetPolicy --> PlanRuleEvaluator: budgetResult
PlanRuleEvaluator -> PacePolicy: check(normalizedPlan)
PacePolicy --> PlanRuleEvaluator: paceResult
PlanRuleEvaluator -> RouteCoherencePolicy: check(normalizedPlan)
RouteCoherencePolicy --> PlanRuleEvaluator: routeResult
PlanRuleEvaluator --> TripDomainModel: validationResult
TripDomainModel --> PlanService: validationResult
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
interface ITripDomainModel {
  validatePlan(input: DomainValidationInput): Promise<DomainValidationResult>
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
interface DomainValidationInput {
  tripId: string
  username: string
  plan: Record<string, unknown>
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
interface DomainRuleFailure {
  code: string
  message: string
  scope?: string
}

interface DomainRuleResult {
  valid: boolean
  failures: DomainRuleFailure[]
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
interface DomainValidationResult {
  valid: boolean
  failures: DomainRuleFailure[]
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

- Domain validation only runs against normalized plan-shaped input.
- Rule failures must be explicit and machine-readable enough for upstream repair loops.
- Domain rules must stay independent from provider adapter formats and UI presentation models.
- The domain model evaluates current-plan legality, not historical plan comparison.

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

- `TripDomainModel` must remain pure business logic and avoid transport, storage, or provider concerns.
- The module does not infer missing plan structure; that belongs to `PlanNormalizer`.
- Rule sets may evolve, but the validation-result shape should remain stable for callers.
- Multi-user negotiation rules for future V5 collaboration are out of scope for the current module design.
