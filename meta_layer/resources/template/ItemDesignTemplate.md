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
      "description": "Each major section should align with its section contract requirements for structure, code-block usage, and expected formatting without copying template comments into the output.",
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

# {DesignItemName} Design

## 0. Document Type

<!--
{
  "section_contract": {
    "section_id": "0",
    "title": "Type",
    "checkitems": [
      "state what kind of design document this is",
      "make the document scope and intended downstream usage explicit",
      "choose exactly one document type",
      "describe included items when relevant",
      "do not list alternative types in the output"
    ],
    "severity": "high",
    "expected_format": "- type: `{DocumentType}`\n- scope: `{ScopeSummary}`\n- includes: `{IncludedItemA}`, `{IncludedItemB}`\n- downstream usage: `{UsageSummary}`\n\nAllowed `DocumentType` values during authoring:\n- `functional_group_design`: one design document for a group of closely related basic units or items, such as generate, update, and contract for one capability area.\n- `test_design`: one design document for test scope, test layers, coverage boundaries, and guidance for follow-up test cases.\n- `reference_design`: one design document used when the capability already exists elsewhere and this document mainly records the adoption boundary and reference link.\n- `protocol_design`: one design document focused on stable interaction API, request/response contracts, and collaboration protocol only.\n\nIn the actual document output, keep only the selected single `type` value and do not copy the allowed-values guide."
  }
}
-->

## 1. Goal

### 1.1 Purpose

<!--
{
    "section_contract": {
      "section_id": "1.1",
      "title": "Purpose",
	      "checkitems": [
	        "define the purpose of the current design document",
	        "make the design-item boundary explicit",
	        "keep the purpose concise and directly understandable without unnecessary background detail"
	      ],
	      "severity": "medium",
	      "expected_format": "{PurposeSentenceOrShortParagraph}"
  }
}
-->

### 1.2 Involved Items

<!--
{
  "section_contract": {
    "section_id": "1.2",
    "title": "Involved Items",
    "checkitems": [
      "list the directly covered design items",
      "list collaborating items, partitions, or external items only when they are necessary for understanding the design"
    ],
    "severity": "medium",
    "expected_format": "This design document directly covers:\n\n- `{DesignItemA}`\n- `{DesignItemB}`\n\nThis design document collaborates with:\n\n- `{CollaboratorA}`\n- `{CollaboratorB}`"
  }
}
-->

### 1.3 Core Functions

<!--
{
    "section_contract": {
      "section_id": "1.3",
      "title": "Core Functions",
	      "checkitems": [
	        "summarize the design-item role",
	        "list the core functions only",
	        "explicitly state what is out of scope for this design document",
	        "the opening role statement should use the current design item identity rather than a broader architecture-layer label when they differ",
	        "when the design item represents several concrete items, basic units, or one partition-level subsystem, prefer naming those concrete items or the design item itself instead of collapsing back to a broader layer label"
	      ],
      "severity": "medium",
      "expected_format": "`{DesignItemName}` is the design item for `{DesignScope}`.\n\nIts core functions are:\n\n- `{CoreFunction1}`\n- `{CoreFunction2}`\n- `{CoreFunction3}`\n- `{CoreFunction4}`\n\n`{DesignItemName}` does not `{OutOfScope1}`, `{OutOfScope2}`, or `{OutOfScope3}`."
  }
}
-->

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
      "show the important classes, interfaces, and dependencies when they materially explain the design item",
      "keep the diagram focused on core structure"
    ],
    "severity": "medium",
    "expected_format": "```plantuml\n' UML class diagram here\n```"
  }
}
-->

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
    "expected_format": "#### 2.2.x `PrimaryService`\n\nRole:\n\n- `{PrimaryRole}`\n\nResponsibilities:\n\n- `{Responsibility1}`\n- `{Responsibility2}`\n- `{Responsibility3}`"
  }
}
-->

## 3. Core Runtime Flow

<!--
{
  "section_contract": {
    "section_id": "3",
    "title": "Core Runtime Flow",
    "checkitems": [
      "this section must be expressed using UML sequence diagram language",
      "the diagram should focus on core runtime interactions between the design item and its collaborators"
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
      "show the main runtime interaction between the initiating actor, the design item, and its collaborators",
      "keep the flow focused on the primary success path"
    ],
    "severity": "medium",
    "expected_format": "```plantuml\n' UML sequence diagram here\n```"
  }
}
-->

## 4. Detailed Design

### 4.1 Core APIs And Types

<!--
{
  "section_contract": {
    "section_id": "4.1",
    "title": "Core APIs And Types",
    "checkitems": [
      "define only stable interfaces and types needed to understand the design item",
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
	      "define only the public API that upstream callers or collaborators need to call",
	      "keep the API structure stable and minimal",
	      "express the public API in a TypeScript code block",
	      "the public API may use interface, type, class signature, or other stable TypeScript boundary forms",
	      "name the public API after the actual exposed boundary or contract surface when appropriate, rather than forcing the design item name into the API symbol"
	    ],
	    "severity": "medium",
	    "expected_format": "```typescript\ninterface {PublicApiName} {\n  {PublicMethod}({PrimaryInputName}: {PrimaryInputType}): {PrimaryOutputType}\n}\n```\n\nor\n\n```typescript\ntype {PublicApiName} = {\n  {PublicMethod}: ({PrimaryInputName}: {PrimaryInputType}) => {PrimaryOutputType}\n}\n```"
	  }
	}
	-->

#### 4.1.2 Input Types

<!--
{
    "section_contract": {
      "section_id": "4.1.2",
      "title": "Input Types",
      "checkitems": [
	        "define only input structures that belong to this design item",
	        "do not repeat upstream shared types unless this design item owns them",
	        "when the design item contains contract-style section definitions, prefer stable names such as `document_contracts` and `section_contracts`",
	        "input format must be defined explicitly in code blocks",
	        "do not use natural-language prose to describe input structure",
	        "TypeScript type definitions must remain the primary content; short code comments are optional but must not replace the type definitions",
	        "do not add explanatory prose before or after the code block in this subsection"
	      ],
      "severity": "medium",
      "expected_format": "```typescript\ninterface {PrimaryInputType} {\n  {InputFieldA}: {InputFieldTypeA}\n  {InputFieldB}?: {InputFieldTypeB}\n}\n\ninterface ContractSpec {\n  document_contracts: DocumentContract[]\n  section_contracts: SectionContract[]\n}\n```\n\nNo prose outside code blocks."
  }
}
-->

#### 4.1.3 Runtime Types

<!--
{
  "section_contract": {
    "section_id": "4.1.3",
    "title": "Runtime Types",
    "checkitems": [
      "define internal runtime structures only when they are necessary for understanding the design item",
      "when present, express runtime types in a TypeScript code block",
      "runtime types may use interface, type, class, or other concise TypeScript structures",
      "this subsection may be omitted when the design item does not own meaningful runtime types"
    ],
    "severity": "medium",
    "expected_format": "```typescript\ninterface {RuntimeTypeA} {\n  {RuntimeFieldA}: {RuntimeFieldTypeA}\n}\n\ntype {RuntimeTypeB} = {\n  {RuntimeFieldB}: {RuntimeFieldTypeB}\n}\n```\n\nThis subsection may be omitted when runtime types are not needed."
  }
}
-->

#### 4.1.4 Output Types

<!--
{
    "section_contract": {
      "section_id": "4.1.4",
      "title": "Output Types",
      "checkitems": [
	        "define the stable output structure produced by this design item",
	        "make downstream-consumed fields explicit",
	        "output format must be defined explicitly in code blocks",
	        "do not use natural-language prose to describe output structure",
	        "TypeScript type definitions must remain the primary content; short code comments are optional but must not replace the type definitions",
	        "do not add explanatory prose before or after the code block in this subsection"
	      ],
      "severity": "medium",
      "expected_format": "```typescript\ninterface {PrimaryOutputType} {\n  {OutputFieldA}: {OutputFieldTypeA}\n  {OutputFieldB}?: {OutputFieldTypeB}\n}\n```\n\nNo prose outside code blocks."
  }
}
-->

#### 4.1.5 Item-Specific Boundary Rules

<!--
{
    "section_contract": {
      "section_id": "4.1.5",
    "title": "Item-Specific Boundary Rules",
    "checkitems": [
      "add this subsection only when the design item has important stable boundary rules that are not already fully expressed by the input types, runtime types, output types, or later runtime-processing sections",
      "express stable item-specific rules that downstream collaborators depend on",
      "avoid repeating detailed path, I/O, or processing content that is already explained elsewhere in the document",
      "prefer bullets over long prose"
    ],
    "severity": "medium",
    "expected_format": "- `{BoundaryRuleAboutUnitSeparation}`\n- `{BoundaryRuleAboutUnifiedEntryOrOwnership}`\n- `{BoundaryRuleAboutStableLogicalNamesOrBoundaryOutputs}`"
  }
}
-->

### 4.2 Internal Runtime Skeleton

<!--
{
  "section_contract": {
    "section_id": "4.2",
    "title": "Internal Runtime Skeleton",
    "checkitems": [
      "describe the internal runtime skeleton of the design item",
      "prefer structured code-block expression such as `plantuml` or other compact skeleton notation over natural-language prose",
      "show the main internal stages, decision points, and handoff points that connect the public API to the internal runtime path",
      "keep the skeleton at item-design level rather than implementation trivia"
    ],
    "severity": "medium",
    "expected_format": "```plantuml\n@startuml\nstart\n:{RuntimeStepA};\nif ({DecisionA}?) then (yes)\n  :{RuntimeStepB};\nelse (no)\n  :{RuntimeStepC};\nendif\n:{RuntimeStepD};\nstop\n@enduml\n```"
  }
}
-->

### 4.3 Runtime Processing Details

<!--
{
  "section_contract": {
    "section_id": "4.3",
    "title": "Runtime Processing Details",
    "checkitems": [
      "use this section to describe what each important basic unit, component, or exposed operation reads, how it processes inputs, and what it emits",
      "prefer organizing this section by concrete runtime item, basic unit, or operation rather than by cross-cutting prose-only categories",
      "keep the description at design level and make read/process/write boundaries explicit",
      "use short labeled blocks such as input loading, processing, and output emission",
      "do not repeat public API signatures or full type definitions here"
    ],
    "severity": "medium",
    "expected_format": "#### 4.3.x `{RuntimeItemA}`\n\nInput loading:\n\n- `{InputSourceA}`\n- `{InputSourceB}`\n\nProcessing:\n\n- `{ProcessingStepA}`\n- `{ProcessingStepB}`\n\nOutput emission:\n\n- `{OutputA}`\n- `{OutputB}`\n\n#### 4.3.y `{RuntimeItemB}`\n\nInput loading:\n\n- `{InputSourceC}`\n\nProcessing:\n\n- `{ProcessingStepC}`\n\nOutput emission:\n\n- `{OutputC}`"
  }
}
-->

### 4.4 Error Handling Skeleton

<!--
{
  "section_contract": {
    "section_id": "4.4",
    "title": "Error Handling Skeleton",
    "checkitems": [
      "describe the main failure paths and recovery-entry shapes of the design item",
      "prefer structured code-block expression such as `plantuml` over natural-language prose",
      "show only the important error branches, error-result shapes, or resume/retry entry points"
    ],
    "severity": "medium",
    "expected_format": "```plantuml\n@startuml\nstart\nif ({ErrorConditionA}?) then (yes)\n  :{ErrorHandlingStepA};\n  stop\nendif\nif ({ErrorConditionB}?) then (yes)\n  :{ErrorHandlingStepB};\n  stop\nendif\n:{RetryOrResumeRule};\nstop\n@enduml\n```"
  }
}
-->

### 4.5 Extension Points

<!--
{
  "section_contract": {
    "section_id": "4.5",
    "title": "Extension Points",
    "checkitems": [
      "add this subsection when the design item has meaningful stable extension points",
      "this subsection is recommended rather than mandatory",
      "for runtime-heavy, policy-heavy, or adapter-heavy design items, prefer keeping this subsection",
      "omit this subsection when there is no real extension-point information gain",
      "prefer structured bullet form over long prose",
      "make it clear what can evolve without changing the main public boundary"
    ],
    "severity": "medium",
    "expected_format": "When present:\n- Extension point: `{ExtensionPointA}`\n  - `{ExtensionRuleA1}`\n  - `{ExtensionRuleA2}`\n- Extension point: `{ExtensionPointB}`\n  - `{ExtensionRuleB1}`\n  - `{ExtensionRuleB2}`\n\nThis subsection may be omitted when the design item has no meaningful stable extension points."
  }
}
-->

### 4.6 Constraints

<!--
{
  "section_contract": {
    "section_id": "4.6",
    "title": "Constraints",
    "checkitems": [
      "record the key design-item constraints and non-goals",
      "include runtime semantics here when needed",
      "avoid implementation trivia"
    ],
    "severity": "medium",
    "expected_format": "- `{Constraint1}`\n- `{Constraint2}`\n- `{Constraint3}`\n- `{Constraint4}`"
  }
}
-->
