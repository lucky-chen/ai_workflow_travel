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
interface ModuleDesignContract
interface ILlmExecutor

class ModuleDesignContractService
class GeneratedResultLoader
class ContractSpecLoader
class ModuleDesignContractPromptBuilder
class ContractResultBuilder

IContractChecker <|-- ModuleDesignContract
ModuleDesignContract <|.. ModuleDesignContractService
ModuleDesignContractService --> GeneratedResultLoader
ModuleDesignContractService --> ContractSpecLoader
ModuleDesignContractService --> ModuleDesignContractPromptBuilder
ModuleDesignContractService --> ILlmExecutor
ModuleDesignContractService --> ContractResultBuilder
@enduml
```

### 2.2 `ModuleDesignContract`

Role:

- module-design-stage contract-check interface

Responsibilities:

- expose `check(context, output)`
- keep module-design-stage contract entry stable for `ModuleStageRunner`

### 2.3 `ModuleDesignContractService`

Role:

- module implementation entry

Responsibilities:

- orchestrate module-design-stage contract check flow
- load generated document result
- load contract specification
- build contract-check request
- convert check result into `ContractCheckResult`

## 3. Core Runtime Flow

### 3.1 Main Sequence Diagram

```plantuml
@startuml
participant ModuleStageRunner
participant ModuleDesignContract
participant ModuleDesignContractService
participant GeneratedResultLoader
participant ContractSpecLoader
participant ModuleDesignContractPromptBuilder
participant ILlmExecutor
participant ContractResultBuilder

ModuleStageRunner -> ModuleDesignContract: check(context, output)
ModuleDesignContract -> ModuleDesignContractService: check(context, output)
ModuleDesignContractService -> GeneratedResultLoader: loadGeneratedResult(output)
GeneratedResultLoader --> ModuleDesignContractService: generated_result
ModuleDesignContractService -> ContractSpecLoader: loadSpec()
ContractSpecLoader --> ModuleDesignContractService: contract_spec
ModuleDesignContractService -> ModuleDesignContractPromptBuilder: build(generated_result, contract_spec)
ModuleDesignContractPromptBuilder --> ModuleDesignContractService: llm_request
ModuleDesignContractService -> ILlmExecutor: execute(llm_request)
ILlmExecutor --> ModuleDesignContractService: llm_result
ModuleDesignContractService -> ContractResultBuilder: build(llm_result)
ContractResultBuilder --> ModuleDesignContractService: contract_check_result
ModuleDesignContractService --> ModuleStageRunner: contract_check_result
@enduml
```

## 4. Detailed Design

### 4.1 Implementation Binding

- Implementation interface: `ModuleDesignContract` extends `IContractChecker`
- Implementation class: `ModuleDesignContractService` implements `ModuleDesignContract`
- Bound by: `ModuleStageRunner`

`ModuleStageRunner` binds:

- `ModuleDesignGenerator`
- `ModuleDesignContract`
- `ITraceRecorder`
- `IChangeGate`
- `IArtifactStore`

### 4.2 Stage-Specific Runtime Rules

#### 4.2.1 Generation

- generation is enabled
- generator source is `Execution/ModuleDesignGenerator`
- generation input is architecture-stage artifact
- generation output is module-design-stage document artifact

#### 4.2.2 Check

- check target is module-design-stage generated document
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

#### 4.2.5 Persistence Limit

- only accepted module-design-stage artifacts may be persisted for downstream stages

### 4.3 Constraints

- reuse the shared flow from [DocumentStageContractPattern.md](./DocumentStageContractPattern.md)
- keep module-design-stage implementation names owned by this module
- do not redefine workflow-owned shared interfaces from [Pipeline.md](../Workflow/Pipeline.md)
