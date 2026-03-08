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

- `project_layer/docs/COLLABORATION_STANDARD.md`

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

This step delivers the shared runtime backbone used by all stages.

- [x] Step 1 is partially completed
- [x] Architecture modules in scope
  - [x] `Interface/CLI`
  - [x] `Workflow/Pipeline`
  - [x] `Workflow/StageRunners`
  - [x] `QualityGate/ChangeGate`
  - [x] `QualityGate/Trace`
  - [x] `Data/ArtifactStore`
  - [x] `Data/HistoryStore`
  - [x] `SDK/LlmExecutor`
- [x] Foundation setup
  - [x] TypeScript project scaffold
  - [x] Shared contracts
- [x] Data layer backbone
  - [x] Local `ArtifactStore`
  - [x] Trace persistence through `HistoryStore`
- [x] Pipeline backbone
  - [x] Minimal `Pipeline`
  - [x] `StageRegistry`
  - [x] `StageDefinition`
  - [x] `LaunchValidator`
  - [x] `BaseStageRunner`
  - [x] Full generic pipeline orchestration
  - [x] Stage-to-stage continuation using `next_stage_id`
  - [x] Downstream input merge between stages
  - [x] Retry/restart semantics
- [x] CLI and review backbone
  - [x] Minimal `CLI`
  - [x] Minimal `ChangeGate`
  - [x] Minimal `Trace`
  - [x] Gate decision trace recording
  - [x] `ChangeReviewPresenter`
  - [x] Full CLI trace rendering
  - [x] Full CLI review interaction
- [x] LLM executor backbone
  - [x] Shared `LlmExecutor`
  - [x] Real OpenAI adapter
  - [x] Real DeepSeek adapter
  - [x] `LlmExecutor` strategy layer
  - [x] `ExecutionStrategySelector`
  - [x] `ILlmTraceRecorder`
- [ ] AgentRuntime backbone
  - [x] Batch 1: interfaces and skeleton
    - [x] `AgentRuntime` core interfaces (`IAgent`, `IPlanner`, `IExecutor`, `IObserver`)
    - [x] `SDK/AgentRuntime` module skeleton and runtime types in the standalone `project_layer/projects/agent_runtime` project
    - [x] SDK-owned agent trace abstraction
    - [x] minimal `DefaultPlanner` and `DefaultObserver`
    - [x] focused tests for interfaces, runtime types, and trace types in the standalone `project_layer/projects/agent_runtime` project
  - [x] Batch 2: single-pass runtime
    - [x] `DefaultExecutor`
    - [x] `DefaultAgent`
    - [x] minimal single-pass `plan -> execute -> observe` runtime
    - [x] trace checkpoints for plan, execution, and observation flow
    - [x] focused tests for single-pass runtime execution
  - [x] Batch 3: llm executor integration
    - [x] composition binding between `LlmExecutor` and `AgentRuntime`
    - [x] `LlmExecutorService` integration through `AgentRuntime`
    - [x] integration tests for runtime path, trace, and `LlmExecutor`

### Step 2. Deliver `requirement_interpretation` Stage

- [ ] Step 2 is not started
- [ ] Architecture modules in scope
  - [ ] `Execution/RequirementGenerator`
  - [ ] `Contract/RequirementContract`
  - [ ] `Workflow/RequirementStageRunner`
- [ ] Batch 1: requirement generation backbone
  - [ ] define requirement-stage upstream input shape
  - [ ] define requirement-stage review/check input shape
  - [ ] `RequirementGenerator` empty implementation placeholder
  - [ ] confirm `RequirementGenerator -> RequirementContract` runtime handoff
- [ ] Batch 2: requirement contract backbone
  - [ ] `RequirementContract`
  - [ ] requirement document structure checks
  - [ ] requirement document contract-alignment checks
  - [ ] stable contract result mapping
  - [ ] focused tests for contract success and failure
- [ ] Batch 3: requirement stage runner flow
  - [ ] `RequirementStageRunner`
  - [ ] direct binding creation inside `RequirementStageRunner`
  - [ ] `generate -> contract -> review` main flow
  - [ ] requirement artifact persistence in runner
  - [ ] requirement trace recording in runner
  - [ ] requirement gate review flow
  - [ ] focused tests for runner and stage flow
- [ ] Batch 4: requirement-stage runtime alignment
  - [ ] align stage input artifact shape with workflow contracts
  - [ ] align generated artifact naming with downstream stage expectations
  - [ ] align trace and review semantics with shared runner behavior
  - [ ] confirm handoff contract into `architecture_design`

### Step 3. Deliver `architecture_design` Stage

- [ ] Step 3 is not started
- [ ] Architecture modules in scope
  - [ ] `Execution/ArchitectureDesignGenerator`
  - [ ] `Contract/ArchitectureDesignContract`
  - [ ] `Workflow/ArchitectureStageRunner`
- [ ] Batch 1: architecture generation backbone
  - [ ] architecture design prompt builder
  - [ ] architecture-stage output builder
  - [ ] `ArchitectureDesignGenerator` implementation
  - [ ] minimal tests for prompt building and output shaping
- [ ] Batch 2: architecture contract backbone
  - [ ] `ArchitectureDesignContract`
  - [ ] architecture document structure checks
  - [ ] architecture section-contract alignment checks
  - [ ] architecture module-boundary consistency checks
  - [ ] focused tests for contract success and failure
- [ ] Batch 3: architecture stage runner flow
  - [ ] `ArchitectureStageRunner`
  - [ ] direct binding creation inside `ArchitectureStageRunner`
  - [ ] `generate -> contract -> review` main flow
  - [ ] architecture artifact persistence in runner
  - [ ] architecture trace recording in runner
  - [ ] architecture gate review flow
  - [ ] focused tests for runner and stage flow
- [ ] Batch 4: architecture-stage runtime alignment
  - [ ] load requirement-stage artifacts as generation input
  - [ ] align output artifacts with module-design stage needs
  - [ ] align trace and review semantics with shared runner behavior
  - [ ] confirm handoff contract into `module_design`

### Step 4. Deliver `module_design` Stage

- [ ] Step 4 is not started
- [ ] Architecture modules in scope
  - [ ] `Execution/ModuleDesignGenerator`
  - [ ] `Contract/ModuleDesignContract`
  - [ ] `Workflow/ModuleStageRunner`
- [ ] Batch 1: module-design generation backbone
  - [ ] module design prompt builder
  - [ ] module-design stage output builder
  - [ ] `ModuleDesignGenerator` implementation
  - [ ] minimal tests for prompt building and output shaping
- [ ] Batch 2: module-design contract backbone
  - [ ] `ModuleDesignContract`
  - [ ] module design document structure checks
  - [ ] class-diagram and section-contract alignment checks
  - [ ] module dependency and responsibility consistency checks
  - [ ] focused tests for contract success and failure
- [ ] Batch 3: module-design stage runner flow
  - [ ] `ModuleStageRunner`
  - [ ] direct binding creation inside `ModuleStageRunner`
  - [ ] `generate -> contract -> review` main flow
  - [ ] module-design artifact persistence in runner
  - [ ] module-design trace recording in runner
  - [ ] module-design gate review flow
  - [ ] focused tests for runner and stage flow
- [ ] Batch 4: module-design runtime alignment
  - [ ] load architecture-stage artifacts as generation input
  - [ ] align output artifacts with implementation-stage needs
  - [ ] align trace and review semantics with shared runner behavior
  - [ ] confirm handoff contract into `implementation`

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

- [ ] Batch 4: execution-environment contract validation
  - [ ] make `ImplementationContract` validate generated changes in a prepared execution environment
  - [ ] apply generated changes into prepared validation workspace before test execution
  - [ ] isolate validation workspace lifecycle from user workspace
  - [ ] extend tests for prepared-environment success and failure cases
- [ ] Batch 5: implementation runner persistence and trace
  - [ ] persist implementation-stage artifacts after successful runner completion
  - [ ] record trace for stage start
  - [ ] record trace for contract result
  - [ ] record trace for gate result
  - [ ] record trace for final apply result
  - [ ] extend tests for artifact persistence and trace flow
- [ ] Batch 6: review and runtime semantics alignment
  - [ ] support review `comment`
  - [ ] align apply/reject behavior with shared review semantics
  - [ ] fully align implementation runtime semantics with design docs
  - [ ] extend tests for comment-aware review outcomes

### Step 6. Deliver `validation` Stage

- [ ] Step 6 is not started
- [ ] Architecture modules in scope
  - [ ] `Contract/ValidationContract`
  - [ ] `Workflow/ValidationStageRunner`
- [ ] Batch 1: validation input and result model
  - [ ] final validation input shape
  - [ ] validation-stage output shape
  - [ ] validation summary and issue model
  - [ ] minimal tests for validation input and output shaping
- [ ] Batch 2: validation contract backbone
  - [ ] `ValidationContract`
  - [ ] final workspace validation checks
  - [ ] final artifact completeness checks
  - [ ] validation result builder
  - [ ] focused tests for contract success and failure
- [ ] Batch 3: validation stage runner flow
  - [ ] `ValidationStageRunner`
  - [ ] `contract -> review` main flow
  - [ ] validation review flow
  - [ ] validation artifact persistence
  - [ ] validation trace flow
  - [ ] focused tests for runner and stage flow
- [ ] Batch 4: validation-stage runtime alignment
  - [ ] load implementation-stage artifacts as validation input
  - [ ] align validation completion semantics with pipeline task completion
  - [ ] align validation review semantics with CLI presentation
  - [ ] confirm final-stage completion behavior

### Step 7. Align Runtime Semantics With Design Docs

- [ ] Step 7 is not started
- [ ] Documents and modules in scope
  - [ ] `Execution/ImplementationGenerator`
  - [ ] `Contract/ImplementationContract`
  - [ ] `Workflow/Pipeline`
  - [ ] `Workflow/StageRunners`
  - [ ] `QualityGate/ChangeGate`
  - [ ] `QualityGate/Trace`
  - [ ] `Interface/CLI`
- [ ] Batch 1: runtime gap inventory
  - [ ] compare implemented behavior with architecture documents
  - [ ] compare implemented behavior with module design documents
  - [ ] identify semantic mismatches in stage transitions and contracts
  - [ ] record required code and document updates
- [ ] Batch 2: pipeline and stage-runner alignment
  - [ ] align pipeline generic orchestration semantics
  - [ ] align stage-runner shared behavior model
  - [ ] align stage continuation and retry semantics
  - [ ] extend tests for orchestration behavior
- [ ] Batch 3: contract, trace, and gate alignment
  - [ ] align implementation runtime semantics
  - [ ] align contract runtime semantics
  - [ ] align trace persistence semantics
  - [ ] align gate presenter and review semantics
  - [ ] extend tests for contract, trace, and review flows
- [ ] Batch 4: CLI and document synchronization
  - [ ] align CLI interaction semantics
  - [ ] update sequence diagrams affected by runtime changes
  - [ ] update plan status to reflect true implementation state
  - [ ] confirm docs and runnable behavior are consistent

### Step 8. Extend Toward Agent Capabilities

- [ ] Step 8 is not started
- [ ] Architecture modules in scope
  - [ ] `SDK/AgentRuntime`
  - [ ] `SDK/LlmExecutor`
  - [ ] workflow automation on top of completed stages
- [ ] Batch 1: AgentRuntime V2 session-aware runtime
  - [ ] `AgentSession` and `AgentMessage` runtime types
  - [ ] `IAgentSessionStore`
  - [ ] session load/save flow in `IAgent`
  - [ ] session-aware trace metadata
  - [ ] tests for session creation, load, update, and save
- [ ] Batch 2: AgentRuntime V2 memory support
  - [ ] `AgentMemory` runtime model
  - [ ] memory update rules across agent runs
  - [ ] memory-aware planner inputs
  - [ ] memory-aware executor inputs
  - [ ] tests for memory persistence and memory-driven execution
- [ ] Batch 3: AgentRuntime V2 MCP support
  - [ ] `IMcpGateway`
  - [ ] MCP request/result types
  - [ ] tool-capable execution plan steps
  - [ ] executor support for MCP tool calls
  - [ ] trace events for tool call and tool result
  - [ ] tests for MCP-enabled execution
- [ ] Batch 4: AgentRuntime V2 multi-turn semantics
  - [ ] step-based execution plan model
  - [ ] richer `ObservationResult` decisions (`accept` / `continue` / `abort`)
  - [ ] bounded multi-iteration agent loop
  - [ ] stop-condition and continuation policies
  - [ ] tests for multi-turn continuation and stop conditions
- [ ] Batch 5: SDLC integration on top of AgentRuntime V2
  - [ ] `LlmExecutor` adaptation to session-aware runtime
  - [ ] MCP-enabled llm execution facade path
  - [ ] workflow-stage integration points for agent-assisted execution
  - [ ] richer workflow automation after core stages are complete
  - [ ] integration tests across `SDK/LlmExecutor` and `SDK/AgentRuntime`

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
