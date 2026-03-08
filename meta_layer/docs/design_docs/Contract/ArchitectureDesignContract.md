# ArchitectureDesignContract Design

## 1. Goal

### 1.1 Purpose

Define the module design of `Contract/ArchitectureDesignContract`.

### 1.2 Involved Modules

This module design directly involves:

- `Contract/ArchitectureDesignContract`

This module design collaborates with:

- `Workflow/Pipeline`
- `Execution/ArchitectureDesignGenerator`
- `SDK/LlmExecutor`

### 1.3 Core Functions

`Contract/ArchitectureDesignContract` is the architecture-design document contract-check module.

Its core functions are:

- follow the shared flow defined in [DocumentStageContractPattern.md](./DocumentStageContractPattern.md)
- check architecture-design-stage generated document output
- load the architecture-stage contract specification
- return structured `ContractCheckResult`

`ArchitectureDesignContract` does not decide workflow progression, gate approval, or artifact persistence.

## 2. Core Classes

### 2.1 Class Diagram

```plantuml
@startuml
interface IContractChecker <<from Workflow/Pipeline>>
interface ILlmExecutor
abstract class DocumentStageContract <<from DocumentStageContractPattern>>

class ArchitectureDesignContract

IContractChecker <|.. DocumentStageContract
DocumentStageContract <|-- ArchitectureDesignContract
ArchitectureDesignContract --> ILlmExecutor
@enduml
```

### 2.2 `ArchitectureDesignContract`

Role:

- architecture-stage contract-check implementation entry

Responsibilities:

- expose `check(context, output)`
- keep architecture-stage contract entry stable for `ArchitectureStageRunner`
- implement the abstract extension points defined by `DocumentStageContract`
- provide architecture-stage-specific contract sources and check-request building
- convert model result into `ContractCheckResult`

## 3. Core Runtime Flow

### 3.1 Main Sequence Diagram

```plantuml
@startuml
participant ArchitectureStageRunner
participant ArchitectureDesignContract
participant ILlmExecutor

ArchitectureStageRunner -> ArchitectureDesignContract: check(context, output)
ArchitectureDesignContract -> ArchitectureDesignContract: loadSpecificContract()
ArchitectureDesignContract -> ArchitectureDesignContract: loadContractFile()
ArchitectureDesignContract --> ArchitectureDesignContract: base_contract_spec
ArchitectureDesignContract -> ArchitectureDesignContract: refineLoadedContract()
ArchitectureDesignContract --> ArchitectureDesignContract: contract_spec
ArchitectureDesignContract -> ArchitectureDesignContract: buildCheckRequest(output, contract_spec)
ArchitectureDesignContract -> ILlmExecutor: execute(llm_request)
ILlmExecutor --> ArchitectureDesignContract: llm_result
ArchitectureDesignContract -> ArchitectureDesignContract: buildContractResult(llm_result)
ArchitectureDesignContract --> ArchitectureStageRunner: contract_check_result
@enduml
```

## 4. Detailed Design

### 4.1 Implementation Binding

- Parent class: `DocumentStageContract`
- Implementation class: `ArchitectureDesignContract` extends `DocumentStageContract`
- Bound by: `ArchitectureStageRunner`

`ArchitectureStageRunner` binds:

- `ArchitectureDesignGenerator`
- `ArchitectureDesignContract`
- `ITraceRecorder`
- `IChangeGate`
- `IArtifactStore`

Overridden methods:

- `getContractFilePath()`
- `getStageId()`
- `refineLoadedContract(baseSpec)`
- `buildCheckRequest(output, contractSpec)`
- `buildContractResult(result)`

### 4.2 Stage-Specific Runtime Rules

#### 4.2.1 Generation

- generation is enabled
- generator source is `Execution/ArchitectureDesignGenerator`
- generation input is requirement-stage artifact
- generation output is architecture-design-stage document artifact

#### 4.2.2 Check

- check target is architecture-design-stage generated document
- check target field path is `output.artifacts.content`
- contract source is `meta_layer/resources/contract/TechnicalArchitectureTemplate.contract.json`
- shared parent logic injects `specific_contract.source` and `specific_contract.stage`
- subclass may refine the loaded contract after file loading when later architecture-stage metadata is needed
- contract-specific rules are architecture document structure rules, section contract rules, and architecture module-boundary consistency rules
- checker output is `ContractCheckResult`

#### 4.2.3 Record

- record stage start
- record architecture contract result
- record review result
- record accepted artifact persistence result

#### 4.2.4 Review Input / Output Limit

- review input must contain architecture-design-stage document summary and artifacts only
- review output is limited to `GateDecision`

Recommended review-request mapping:

```ts
ChangeReviewRequest {
  taskId: context.taskId
  stageId: "architecture_design"
  summary: output.summary
  changedPaths: ["docs/architecture/TechnicalArchitecture.md"]
  changedFiles: [
    {
      path: "docs/architecture/TechnicalArchitecture.md",
      operation: "create_or_update",
      content: output.artifacts.content,
    },
  ]
}
```

#### 4.2.5 Persistence Limit

- only accepted architecture-design-stage artifacts may be persisted for downstream stages
- `ArchitectureStageRunner` persists accepted output to `docs/architecture/TechnicalArchitecture.md`
- downstream `ModuleDesignGenerator` receives the persisted content through `inputArtifacts["architecture_document"]`

### 4.3 Constraints

- reuse the shared flow from [DocumentStageContractPattern.md](./DocumentStageContractPattern.md)
- keep shared orchestration in parent `DocumentStageContract.check`
- keep architecture-stage implementation names owned by this module
- do not redefine workflow-owned shared interfaces from [Pipeline.md](../Workflow/Pipeline.md)
