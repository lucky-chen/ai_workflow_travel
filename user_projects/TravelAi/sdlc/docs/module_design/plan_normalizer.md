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

# PlanNormalizer Design

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

定义 `PlanNormalizer` 如何把生成候选结果转换为稳定的 `plan` 结构，明确其只负责结构归一化和显式缺陷标记，不负责最终业务合法性裁决。

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

- `./module_design/plan_normalizer.md`

This module design collaborates with:

- `./module_design/plan_service.md`
- `./module_design/schedule_service.md`
- `./module_design/trip_domain_model.md`

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

`PlanNormalizer` is the candidate-to-stable-plan normalization module.

Its core functions are:

- transform variable candidate outputs into a stable plan-shaped structure
- fill missing structural defaults needed by downstream modules
- detect explicit shape conflicts, missing required sections, and normalization errors
- return normalized data plus issue markers for downstream domain validation

`PlanNormalizer` does not decide business legality, call external providers, or persist final outputs.

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
interface IPlanNormalizer {
  +normalize(input: PlanNormalizationInput): PlanNormalizationOutput
}

class PlanNormalizer
class CandidateShapeParser
class PlanStructureMapper
class NormalizationIssueCollector

IPlanNormalizer <|.. PlanNormalizer
PlanNormalizer --> CandidateShapeParser
PlanNormalizer --> PlanStructureMapper
PlanNormalizer --> NormalizationIssueCollector
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

### 2.2 `PlanNormalizer`

Role:

- normalization facade for plan-shaped outputs

Responsibilities:

- accept candidate whole-plan or local-schedule results
- map them into a stable downstream plan structure
- attach explicit normalization issues for later validation or repair loops

### 2.2 `PlanStructureMapper`

Role:

- stable plan-shape constructor

Responsibilities:

- align varying candidate fields into the canonical plan structure
- apply required defaults for missing but mandatory structural sections
- keep field mapping logic out of domain validation

### 2.2 `NormalizationIssueCollector`

Role:

- normalization defect tracker

Responsibilities:

- mark missing fields, conflicting fields, and unparseable sections
- keep issue output machine-readable enough for repair loops
- avoid making final accept/reject decisions beyond explicit normalization failure

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
participant PlanNormalizer
participant CandidateShapeParser
participant PlanStructureMapper
participant NormalizationIssueCollector

PlanService -> PlanNormalizer: normalize(planNormalizationInput)
PlanNormalizer -> CandidateShapeParser: parse(candidate)
CandidateShapeParser --> PlanNormalizer: parsedCandidate
PlanNormalizer -> PlanStructureMapper: map(parsedCandidate)
PlanStructureMapper --> PlanNormalizer: normalizedPlan
PlanNormalizer -> NormalizationIssueCollector: collect(parsedCandidate, normalizedPlan)
NormalizationIssueCollector --> PlanNormalizer: normalizationIssues
PlanNormalizer --> PlanService: planNormalizationOutput
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
interface IPlanNormalizer {
  normalize(input: PlanNormalizationInput): Promise<PlanNormalizationOutput>
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
interface PlanNormalizationInput {
  scope: 'whole_plan' | 'local_schedule'
  candidate: Record<string, unknown>
  tripId: string
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
interface NormalizedPlan {
  plan: Record<string, unknown>
}

interface NormalizationIssue {
  code: string
  fieldPath?: string
  message: string
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
interface PlanNormalizationOutput {
  normalizedPlan: Record<string, unknown>
  issues: NormalizationIssue[]
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

- `PlanNormalizer` must always return plan-shaped output or explicit normalization issues; silent shape failure is not allowed.
- Normalization must be deterministic for the same candidate input.
- The module may add structural defaults, but it must not invent business decisions not implied by the candidate.
- Final business legality remains the responsibility of `TripDomainModel`.

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

- `PlanNormalizer` must stay implementation-focused on structure normalization rather than policy decisions.
- The module operates before action projection and therefore must output a stable enough plan shape for downstream consumers.
- The module must support both whole-plan and local-schedule normalization paths.
- LLM prompt design and candidate-generation strategies remain outside this module.
