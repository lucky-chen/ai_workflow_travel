# Code Generation Execution Plan

## 1. Purpose

This document is the implementation plan for building `project_layer` from zero to the complete workflow defined by:

- `meta_layer/docs/TechnicalArchitecture.md`
- `meta_layer/docs/design_docs/SystemInteractionDesign.md`
- `meta_layer/docs/design_docs/*`

This plan is organized to match:

- the workflow runtime order
- the architecture module boundaries

## 1.1 Collaboration Rule

All implementation work under this plan must follow the shared collaboration standard:

- `project_layer/COLLABORATION_STANDARD.md`

This plan keeps only delivery status and implementation scope. Collaboration behavior is defined in the shared standard document.

## 2. Workflow Delivery Order

The implementation should be delivered in this order:

1. shared workflow backbone
2. `requirement_interpretation` stage
3. `architecture_design` stage
4. `module_design` stage
5. `implementation` stage
6. `validation` stage
7. runtime and design-doc alignment
8. agent capability extension

## 3. Execution Steps

### Step 1. Deliver Shared Workflow Backbone

Status:

- [x] Partially completed

This step delivers the shared runtime backbone used by all stages.

Architecture modules in scope:

- `Interface/CLI`
- `Workflow/Pipeline`
- `Workflow/StageRunners`
- `QualityGate/ChangeGate`
- `QualityGate/Trace`
- `Data/ArtifactStore`
- `Data/HistoryStore`
- `SDK/LlmExecutor`

What to build:

- [x] TypeScript project scaffold
- [x] Shared contracts
- [x] Local `ArtifactStore`
- [x] Shared `LlmExecutor`
- [x] Real OpenAI adapter
- [x] Real DeepSeek adapter
- [x] Minimal `Pipeline`
- [x] Minimal `CLI`
- [x] Minimal `Trace`
- [x] Minimal `ChangeGate`

Still missing:

- [x] `StageRegistry`
- [x] `StageDefinition`
- [x] `LaunchValidator`
- [x] `BaseStageRunner`
- [ ] Full generic pipeline orchestration
- [x] Stage-to-stage continuation using `next_stage_id`
- [x] Downstream input merge between stages
- [ ] Retry/restart semantics
- [ ] Trace persistence through `HistoryStore`
- [x] Gate decision trace recording
- [x] `ChangeReviewPresenter`
- [x] Full CLI trace rendering
- [x] Full CLI review interaction
- [ ] `LlmExecutor` strategy layer
- [ ] `ExecutionStrategySelector`
- [ ] `IAgent`
- [ ] `IPlanner`
- [ ] `IExecutor`
- [ ] `IObserver`
- [ ] `ILlmTraceRecorder`

### Step 2. Deliver `requirement_interpretation` Stage

Status:

- [ ] Not started

Architecture modules in scope:

- `Execution/RequirementGenerator`
- `Contract/RequirementContract`
- `Workflow/RequirementStageRunner`

What to build:

- [ ] `RequirementGenerator`
- [ ] prompt builder for requirement interpretation
- [ ] stage output builder
- [ ] `RequirementContract`
- [ ] `RequirementStageRunner`
- [ ] artifact persistence in runner
- [ ] trace recording in runner
- [ ] gate review flow in runner
- [ ] tests for generator, contract, runner, and stage flow

### Step 3. Deliver `architecture_design` Stage

Status:

- [ ] Not started

Architecture modules in scope:

- `Execution/ArchitectureDesignGenerator`
- `Contract/ArchitectureDesignContract`
- `Workflow/ArchitectureStageRunner`

What to build:

- [ ] `ArchitectureDesignGenerator`
- [ ] architecture prompt builder
- [ ] stage output builder
- [ ] `ArchitectureDesignContract`
- [ ] `ArchitectureStageRunner`
- [ ] artifact persistence in runner
- [ ] trace recording in runner
- [ ] gate review flow in runner
- [ ] tests for generator, contract, runner, and stage flow

### Step 4. Deliver `module_design` Stage

Status:

- [ ] Not started

Architecture modules in scope:

- `Execution/ModuleDesignGenerator`
- `Contract/ModuleDesignContract`
- `Workflow/ModuleStageRunner`

What to build:

- [ ] `ModuleDesignGenerator`
- [ ] module design prompt builder
- [ ] stage output builder
- [ ] `ModuleDesignContract`
- [ ] `ModuleStageRunner`
- [ ] artifact persistence in runner
- [ ] trace recording in runner
- [ ] gate review flow in runner
- [ ] tests for generator, contract, runner, and stage flow

### Step 5. Deliver `implementation` Stage

Status:

- [x] In progress

Architecture modules in scope:

- `Execution/ImplementationGenerator`
- `Contract/ImplementationContract`
- `Workflow/ImplementationStageRunner`

Already built:

- [x] `ImplementationGenerator`
- [x] implementation prompt builder
- [x] change parsing
- [x] planned change output
- [x] `ImplementationContract`
- [x] `ImplementationStageRunner`
- [x] `generate -> contract -> review -> apply` main flow
- [x] runnable tests for the vertical slice

Still missing:

- [ ] make `ImplementationContract` validate generated changes in a prepared execution environment
- [ ] persist implementation-stage artifacts after successful runner completion
- [ ] record trace for stage start
- [ ] record trace for contract result
- [ ] record trace for gate result
- [ ] record trace for final apply result
- [ ] support review `comment`
- [ ] fully align implementation runtime semantics with design docs

### Step 6. Deliver `validation` Stage

Status:

- [ ] Not started

Architecture modules in scope:

- `Contract/ValidationContract`
- `Workflow/ValidationStageRunner`

What to build:

- [ ] final validation input shape
- [ ] `ValidationContract`
- [ ] `ValidationStageRunner`
- [ ] validation review flow
- [ ] validation artifact persistence
- [ ] validation trace flow
- [ ] validation tests

### Step 7. Align Runtime Semantics With Design Docs

Status:

- [ ] Not started

This step fixes the gap between implemented runtime behavior and the design documents.

Documents and modules to align:

- `Execution/ImplementationGenerator`
- `Contract/ImplementationContract`
- `Workflow/Pipeline`
- `Workflow/StageRunners`
- `QualityGate/ChangeGate`
- `QualityGate/Trace`
- `Interface/CLI`

What to align:

- [ ] implementation runtime semantics
- [ ] contract runtime semantics
- [ ] pipeline generic orchestration semantics
- [ ] stage-runner shared behavior model
- [ ] trace persistence semantics
- [ ] gate presenter and review semantics
- [ ] CLI interaction semantics
- [ ] sequence diagrams affected by runtime changes

### Step 8. Extend Toward Agent Capabilities

Status:

- [ ] Not started

Architecture modules in scope:

- `SDK/LlmExecutor`
- workflow automation on top of completed stages

What to build:

- [ ] `ExecutionStrategySelector`
- [ ] `IAgent`
- [ ] `IPlanner`
- [ ] `IExecutor`
- [ ] `IObserver`
- [ ] richer workflow automation after core stages are complete

## 4. Current Status Summary

- [x] Step 1 has a usable V1 backbone
- [ ] Step 2 is not started
- [ ] Step 3 is not started
- [ ] Step 4 is not started
- [x] Step 5 is in progress
- [ ] Step 6 is not started
- [ ] Step 7 is not started
- [ ] Step 8 is not started

## 5. Verification Rule

Before marking a step or task complete:

- [ ] Run `tsc`
- [ ] Run related tests
- [ ] Confirm what is truly runnable
- [ ] Do not mark placeholders as complete

## 6. How To Use This Document

- [ ] Start from the earliest unfinished step
- [ ] Complete one task end to end
- [ ] Verify it
- [ ] Mark status honestly
- [ ] Update the document when implementation meaningfully changes
