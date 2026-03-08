# StageRunners Design

## 1. Scope

Define the consolidated design of all concrete stage runner classes owned by `Workflow`.

This document is the single place for:

- concrete runner class list per stage
- runner inheritance from `BaseStageRunner`
- stage-level dependency binding (`Execution/*`, `Contract/*`, `QualityGate/*`, `Data/*`)

`BaseStageRunner` and shared contracts are defined in [Pipeline.md](./Pipeline.md). This document does not redefine them.

## 2. Runner Model

### 2.1 Class Diagram

```plantuml
@startuml
abstract class BaseStageRunner <<from Pipeline>>
interface IStageGenerator <<from Pipeline>>
interface IContractChecker <<from Pipeline>>
interface IChangeGate <<from Pipeline>>
interface ITraceRecorder <<from Pipeline>>
interface IArtifactStore <<from Pipeline>>

class RequirementStageRunner <<public>>
class ArchitectureStageRunner <<public>>
class ModuleStageRunner <<public>>
class ImplementationStageRunner <<public>>
class ValidationStageRunner <<public>>

BaseStageRunner <|-- RequirementStageRunner
BaseStageRunner <|-- ArchitectureStageRunner
BaseStageRunner <|-- ModuleStageRunner
BaseStageRunner <|-- ImplementationStageRunner
BaseStageRunner <|-- ValidationStageRunner

RequirementStageRunner --> IStageGenerator
ArchitectureStageRunner --> IStageGenerator
ModuleStageRunner --> IStageGenerator
ImplementationStageRunner --> IStageGenerator

RequirementStageRunner --> IContractChecker
ArchitectureStageRunner --> IContractChecker
ModuleStageRunner --> IContractChecker
ImplementationStageRunner --> IContractChecker
ValidationStageRunner --> IContractChecker

RequirementStageRunner --> IChangeGate
ArchitectureStageRunner --> IChangeGate
ModuleStageRunner --> IChangeGate
ImplementationStageRunner --> IChangeGate
ValidationStageRunner --> IChangeGate

RequirementStageRunner --> ITraceRecorder
ArchitectureStageRunner --> ITraceRecorder
ModuleStageRunner --> ITraceRecorder
ImplementationStageRunner --> ITraceRecorder
ValidationStageRunner --> ITraceRecorder

RequirementStageRunner --> IArtifactStore
ArchitectureStageRunner --> IArtifactStore
ModuleStageRunner --> IArtifactStore
ImplementationStageRunner --> IArtifactStore
ValidationStageRunner --> IArtifactStore
@enduml
```

### 2.2 Shared API

```ts
class RequirementStageRunner extends BaseStageRunner {
  run(context: StageRunContext): StageOutput
}

class ArchitectureStageRunner extends BaseStageRunner {
  run(context: StageRunContext): StageOutput
}

class ModuleStageRunner extends BaseStageRunner {
  run(context: StageRunContext): StageOutput
}

class ImplementationStageRunner extends BaseStageRunner {
  run(context: StageRunContext): StageOutput
}

class ValidationStageRunner extends BaseStageRunner {
  run(context: StageRunContext): StageOutput
}
```

All runners keep the same public signature as `BaseStageRunner`.

## 3. Stage Binding

| stage_id | runner_class | execution_binding | contract_binding | gate_policy |
| --- | --- | --- | --- | --- |
| `requirement_interpretation` | `RequirementStageRunner` | `Execution/RequirementGenerator.run` | `Contract/RequirementContract.check` | `review_required` |
| `architecture_design` | `ArchitectureStageRunner` | `Execution/ArchitectureDesignGenerator.run` | `Contract/ArchitectureDesignContract.check` | `review_required` |
| `module_design` | `ModuleStageRunner` | `Execution/ModuleDesignGenerator.run` | `Contract/ModuleDesignContract.check` | `review_required` |
| `implementation` | `ImplementationStageRunner` | `Execution/ImplementationGenerator.run` | `Contract/ImplementationContract.check` | `review_required` |
| `validation` | `ValidationStageRunner` | `none` | `Contract/ValidationContract.check` | `review_required_for_final_result` |

Stage exceptions:

- `validation` does not bind an execution module and uses `Contract/ValidationContract.check` as its validation confirmation input before gate review.

## 4. Runtime Responsibilities

For each stage runner:

1. record stage start trace
2. call bound `Execution/*` run when execution binding is defined
3. load upstream review/check input directly when the stage has no execution binding
4. call bound `Contract/*` check when enabled for that stage
5. call `QualityGate/ChangeGate.review`
6. call `IArtifactStore.create` on pass
7. return `StageOutput`

Dependency rule:

- concrete stage runners depend only on pipeline-owned collaboration interfaces such as `ITraceRecorder`, `IChangeGate`, and `IArtifactStore`
- concrete stage runners may directly create stage-local generator and contract bindings inside the runner when the implementation stays within workflow-owned composition boundaries
- stage runners should not rely on a separate application composition root for stage-local execution and contract binding
