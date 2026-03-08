<!--
AI_EDIT_PROTECTION:
- This file is protected.
- Do not modify this file unless the user explicitly requests changes to this exact file.
-->

# ModuleDesignContract Design

## 1. Goal

### 1.1 Purpose

Define the module design of `Contract/ModuleDesignContract`.

### 1.2 Involved Modules

This module design directly involves:

- `Contract/ModuleDesignContract`

This module design collaborates with:

- `Workflow/Pipeline`
- `Execution/ModuleDesignGenerator`
- `SDK/LlmExecutor`

### 1.3 Core Functions

`Contract/ModuleDesignContract` is the module-design document contract-check module.

Its core functions are:

- follow the shared flow defined in [DocumentStageContractPattern.md](./DocumentStageContractPattern.md)
- check module-design-stage generated document output
- return structured `ContractCheckResult`

`ModuleDesignContract` does not decide workflow progression, gate approval, or artifact persistence.

## 2. Core Classes

### 2.1 Class Diagram

```plantuml
@startuml
interface IContractChecker <<from Workflow/Pipeline>>
interface ILlmExecutor
abstract class DocumentStageContract <<from DocumentStageContractPattern>>

class ModuleDesignContract

IContractChecker <|.. DocumentStageContract
DocumentStageContract <|-- ModuleDesignContract
ModuleDesignContract --> ILlmExecutor
@enduml
```

### 2.2 `ModuleDesignContract`

Role:

- module-design-stage contract-check implementation entry

Responsibilities:

- expose `check(context, output)`
- keep module-design-stage contract entry stable for `ModuleStageRunner`
- implement the abstract extension points defined by `DocumentStageContract`
- provide module-design-stage-specific contract sources and check-request building
- convert check result into `ContractCheckResult`

## 3. Core Runtime Flow

### 3.1 Main Sequence Diagram

```plantuml
@startuml
participant ModuleStageRunner
participant ModuleDesignContract
participant ILlmExecutor

ModuleStageRunner -> ModuleDesignContract: check(context, output)
ModuleDesignContract -> ModuleDesignContract: loadSharedContract()
ModuleDesignContract --> ModuleDesignContract: shared_contract
ModuleDesignContract -> ModuleDesignContract: loadSpecificContract()
ModuleDesignContract --> ModuleDesignContract: specific_contract
ModuleDesignContract -> ModuleDesignContract: buildCheckRequest(output, contract_spec)
ModuleDesignContract -> ILlmExecutor: execute(llm_request)
ILlmExecutor --> ModuleDesignContract: llm_result
ModuleDesignContract -> ModuleDesignContract: buildContractResult(llm_result)
ModuleDesignContract --> ModuleStageRunner: contract_check_result
@enduml
```

## 4. Detailed Design

### 4.1 Implementation Binding

- Parent class: `DocumentStageContract`
- Implementation class: `ModuleDesignContract` extends `DocumentStageContract`
- Bound by: `ModuleStageRunner`

`ModuleStageRunner` binds:

- `ModuleDesignGenerator`
- `ModuleDesignContract`
- `ITraceRecorder`
- `IChangeGate`
- `IArtifactStore`

Overridden methods:

- `loadSharedContract()`
- `loadSpecificContract()`
- `buildCheckRequest(output, contractSpec)`
- `buildContractResult(result)`

### 4.2 Stage-Specific Runtime Rules

#### 4.2.1 Generation

- generation is enabled
- generator source is `Execution/ModuleDesignGenerator`
- generation input is architecture-stage artifact
- generation output is module-design-stage document artifact

#### 4.2.2 Check

- check target is module-design-stage generated document
- check target field path is `output.artifacts.content`
- contract source is `meta_layer/resources/contract/ModuleDesignTemplate.contract.json`
- contract-specific rules are module document structure rules, class-diagram consistency rules, and module dependency/responsibility consistency rules
- checker output is `ContractCheckResult`

#### 4.2.3 Record

- record stage start
- record module-design contract result
- record review result
- record accepted artifact persistence result

#### 4.2.4 Review Input / Output Limit

- review input must contain module-design-stage document summary and artifacts only
- review output is limited to `GateDecision`

Recommended review-request mapping:

```ts
ChangeReviewRequest {
  taskId: context.taskId
  stageId: "module_design"
  summary: output.summary
  changedPaths: [`docs/module_design/${output.artifacts.moduleName}.md`]
  changedFiles: [
    {
      path: `docs/module_design/${output.artifacts.moduleName}.md`,
      operation: "create_or_update",
      content: output.artifacts.content,
    },
  ]
}
```

#### 4.2.5 Persistence Limit

- only accepted module-design-stage artifacts may be persisted for downstream stages
- `ModuleStageRunner` persists accepted output to `docs/module_design/{moduleName}.md`
- downstream `ImplementationGenerator` receives accepted output through `inputArtifacts["module_design_document"]`

### 4.3 Constraints

- reuse the shared flow from [DocumentStageContractPattern.md](./DocumentStageContractPattern.md)
- keep shared orchestration in parent `DocumentStageContract.check`
- keep module-design-stage implementation names owned by this module
- do not redefine workflow-owned shared interfaces from [Pipeline.md](../Workflow/Pipeline.md)
