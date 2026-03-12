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

# TripApplicationService Design

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

定义 `TripApplicationService` 的入口路由边界、用户名归属处理和轻量协调职责，聚焦外部请求如何被转化为稳定的领域命令，不展开 `PlanService`、`ScheduleService` 等下游模块内部实现。

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

- `./module_design/trip_application_service.md`

This module design collaborates with:

- `./module_design/plan_service.md`
- `./module_design/schedule_service.md`
- `./module_design/action_service.md`
- `./module_design/trip_record_service.md`
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

`TripApplicationService` is the external request routing and application-boundary normalization module.

Its core functions are:

- accept external trip, plan, schedule, action, record, and summary requests
- bind requests to a stable username-scoped application context
- route requests to the correct downstream capability module with minimal command shaping
- return unified response envelopes back to `TravelClientService`

`TripApplicationService` does not solve plan logic, own domain validation loops, or become a system-wide orchestration module.

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
interface ITripApplicationService {
  +handle(request: ApplicationRequest): ApplicationResponse
}

class TripApplicationService
class UsernameContextResolver
class RequestValidator
class RequestRouter
class ResponsePresenter

interface IPlanService
interface IScheduleService
interface IActionService
interface ITripRecordService

ITripApplicationService <|.. TripApplicationService
TripApplicationService --> UsernameContextResolver
TripApplicationService --> RequestValidator
TripApplicationService --> RequestRouter
TripApplicationService --> ResponsePresenter

RequestRouter --> IPlanService
RequestRouter --> IScheduleService
RequestRouter --> IActionService
RequestRouter --> ITripRecordService
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

### 2.2 `TripApplicationService`

Role:

- application-layer entry for TravelAi backend requests

Responsibilities:

- receive requests from `TravelClientService`
- resolve username-scoped context and validate minimal request shape
- route requests into the correct capability module

### 2.2 `UsernameContextResolver`

Role:

- username ownership binder

Responsibilities:

- resolve a stable username from request input
- attach username scope to downstream commands
- keep ownership binding separate from business logic

### 2.2 `RequestRouter`

Role:

- application-level capability router

Responsibilities:

- map external request types to `PlanService`, `ScheduleService`, `ActionService`, or `TripRecordService`
- keep routing lightweight and deterministic
- avoid embedding downstream solve logic

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
actor TravelClientService
participant TripApplicationService
participant UsernameContextResolver
participant RequestValidator
participant PlanService

TravelClientService -> TripApplicationService: handle(applicationRequest)
TripApplicationService -> UsernameContextResolver: resolve(request)
UsernameContextResolver --> TripApplicationService: usernameContext
TripApplicationService -> RequestValidator: validate(request)
RequestValidator --> TripApplicationService: valid
TripApplicationService -> PlanService: handle(planCommand)
PlanService --> TripApplicationService: planResult
TripApplicationService --> TravelClientService: applicationResponse
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
interface ITripApplicationService {
  handle(request: ApplicationRequest): Promise<ApplicationResponse>
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
type ApplicationRequest =
  | PlanApplicationRequest
  | ScheduleApplicationRequest
  | ActionApplicationRequest
  | RecordApplicationRequest

interface PlanApplicationRequest {
  route: 'plan'
  username: string
  payload: Record<string, unknown>
}

interface ScheduleApplicationRequest {
  route: 'schedule'
  username: string
  payload: Record<string, unknown>
}

interface ActionApplicationRequest {
  route: 'action'
  username: string
  payload: Record<string, unknown>
}

interface RecordApplicationRequest {
  route: 'record'
  username: string
  payload: Record<string, unknown>
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
interface UsernameContext {
  username: string
}

interface RoutedCommand {
  target: 'plan' | 'schedule' | 'action' | 'record'
  username: string
  command: Record<string, unknown>
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
interface ApplicationResponse {
  route: string
  tripId?: string
  result: Record<string, unknown>
  warnings?: string[]
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

- `TripApplicationService` must always attach username scope before calling downstream modules.
- Request validation at this layer is limited to route shape, required fields, and minimal ownership context.
- The application layer may reshape local-adjustment input into a `ScheduleService` command, but it must not absorb schedule-solving logic.
- Response formatting should remain thin and avoid inventing business summaries beyond downstream outputs.

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

- `TripApplicationService` must stay a thin routing boundary and must not evolve into a business-orchestration center.
- The module uses lightweight username identity only and does not implement complex authentication or security workflows.
- Business legality, plan quality, and provider fallback decisions belong to downstream capability modules.
- External transport concerns such as HTTP controller wiring remain outside this module design document.
