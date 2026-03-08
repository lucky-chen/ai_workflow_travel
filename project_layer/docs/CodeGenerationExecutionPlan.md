# Code Generation Execution Plan

Template source:

- `meta_layer/resources/template/CodeGenerationExecutionPlanTemplate.md`

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
5. `implementation_plan` stage
6. `implementation_execution` stage
7. `validation` stage
8. runtime and design-doc alignment
9. agent capability extension

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

- [x] Step 2 is in progress
- [x] Architecture modules in scope
  - [x] `Execution/RequirementGenerator`
  - [x] `Contract/RequirementContract`
  - [x] `Workflow/RequirementStageRunner`
- [x] Batch 1: requirement generation backbone
  - [x] define requirement-stage upstream input shape
  - [x] define requirement-stage review/check input shape
  - [x] `RequirementGenerator` empty implementation placeholder
  - [x] confirm `RequirementGenerator -> RequirementContract` runtime handoff
- [x] Batch 2: requirement contract backbone
  - [x] `RequirementContract`
  - [x] requirement document structure checks
  - [x] requirement document contract-alignment checks
  - [x] stable contract result mapping
  - [x] focused tests for contract success and failure
- [x] Batch 2.1: requirement contract prompt path alignment
  - [x] align `buildCheckRequest(...)` with contract-check prompt construction
  - [x] make request shape compatible with later `ILlmExecutor` integration
  - [x] define stable prompt input for requirement document and contract spec
  - [x] execute requirement contract checks through real `ILlmExecutor`
  - [x] parse real `LlmExecutionResult` into stable `ContractCheckResult`
  - [x] extend tests for prompt request construction and result mapping
- [x] Batch 3: requirement stage runner flow
  - [x] `RequirementStageRunner`
  - [x] direct binding creation inside `RequirementStageRunner`
  - [x] `generate -> contract -> review` main flow
  - [x] requirement artifact persistence in runner
  - [x] requirement trace recording in runner
  - [x] requirement gate review flow
  - [x] focused tests for runner and stage flow
- [x] Batch 4: requirement-stage runtime alignment
  - [x] align stage input artifact shape with workflow contracts
  - [x] align generated artifact naming with downstream stage expectations
  - [x] align trace and review semantics with shared runner behavior
  - [x] confirm handoff contract into `architecture_design`

### Step 3. Deliver `architecture_design` Stage

- [x] Step 3 is in progress
- [x] Architecture modules in scope
  - [x] `Execution/ArchitectureDesignGenerator`
  - [x] `Contract/ArchitectureDesignContract`
  - [x] `Workflow/ArchitectureStageRunner`
- [x] Batch 1: architecture generation backbone
  - [x] architecture design prompt builder
  - [x] architecture-stage output builder
  - [x] `ArchitectureDesignGenerator` implementation
  - [x] minimal tests for prompt building and output shaping
- [ ] Batch 2: architecture contract backbone
  - [x] `ArchitectureDesignContract`
  - [x] architecture document structure checks
  - [x] architecture section-contract alignment checks
  - [x] architecture module-boundary consistency checks
  - [x] architecture contract-check prompt construction
  - [x] real `ILlmExecutor`-based architecture contract execution
  - [x] real `LlmExecutionResult` to `ContractCheckResult` mapping
  - [x] focused tests for contract success and failure
- [x] Batch 3: architecture stage runner flow
  - [x] `ArchitectureStageRunner`
  - [x] direct binding creation inside `ArchitectureStageRunner`
  - [x] `generate -> contract -> review` main flow
  - [x] architecture artifact persistence in runner
  - [x] architecture trace recording in runner
  - [x] architecture gate review flow
  - [x] focused tests for runner and stage flow
- [x] Batch 4: architecture-stage runtime alignment
  - [x] load requirement-stage artifacts as generation input
  - [x] align output artifacts with module-design stage needs
  - [x] align trace and review semantics with shared runner behavior
  - [x] confirm handoff contract into `module_design`

### Step 4. Deliver `module_design` Stage

- [x] Step 4 is in progress
- [x] Architecture modules in scope
  - [x] `Execution/ModuleDesignGenerator`
  - [x] `Contract/ModuleDesignContract`
  - [x] `Workflow/ModuleStageRunner`
- [x] Batch 1: module-design generation backbone
  - [x] module design prompt builder
  - [x] module-design stage output builder
  - [x] `ModuleDesignGenerator` implementation
  - [x] minimal tests for prompt building and output shaping
- [x] Batch 2: module-design contract backbone
  - [x] `ModuleDesignContract`
  - [x] module design document structure checks
  - [x] class-diagram and section-contract alignment checks
  - [x] module dependency and responsibility consistency checks
  - [x] module-design contract-check prompt construction
  - [x] real `ILlmExecutor`-based module-design contract execution
  - [x] real `LlmExecutionResult` to `ContractCheckResult` mapping
  - [x] focused tests for contract success and failure
- [x] Batch 3: module-design stage runner flow
  - [x] `ModuleStageRunner`
  - [x] direct binding creation inside `ModuleStageRunner`
  - [x] `generate -> contract -> review` main flow
  - [x] module-design artifact persistence in runner
  - [x] module-design trace recording in runner
  - [x] module-design gate review flow
  - [x] focused tests for runner and stage flow
- [x] Batch 4: module-design runtime alignment
  - [x] load architecture-stage artifacts as generation input
  - [x] parse module count and ordered module descriptors from accepted `architecture_document`
  - [x] launch one `module_design` execution per module in sequence
  - [x] aggregate accepted module-design outputs into `inputArtifacts["module_design_documents"]`
  - [x] align output artifacts with `implementation_plan` input needs
  - [x] align trace and review semantics with shared runner behavior
  - [x] confirm handoff contract into `implementation_plan`

### Step 5. Deliver `implementation_plan` Stage

- [x] Step 5 is in progress
- [x] Architecture modules in scope
  - [ ] `Execution/ImplementationPlanGenerator`
  - [ ] `Contract/ImplementationPlanContract`
  - [ ] `Workflow/ImplementationPlanStageRunner`
- [x] Batch 1: implementation plan generation backbone
  - [x] `ImplementationPlanGenerator`
  - [x] ordered project-level `workplan` generation
  - [x] load requirement, architecture, and all module-design documents as plan input
  - [x] review generated `workplan`
  - [x] focused tests for workplan generation flow
- [x] Batch 2: implementation plan contract backbone
  - [x] `ImplementationPlanContract`
  - [x] implementation-plan contract-check prompt construction
  - [x] real `ILlmExecutor`-based implementation-plan contract execution
  - [x] real `LlmExecutionResult` to `ContractCheckResult` mapping
  - [x] focused tests for contract success and failure
- [ ] Batch 3: implementation plan stage runner flow
  - [ ] `ImplementationPlanStageRunner`
  - [ ] direct binding creation inside `ImplementationPlanStageRunner`
  - [ ] `generate -> contract -> review` main flow
  - [ ] persist accepted `workplan`
  - [ ] implementation-plan trace recording in runner
  - [ ] implementation-plan gate review flow
  - [ ] focused tests for runner and stage flow
- [ ] Batch 4: implementation-plan runtime alignment
  - [ ] handoff accepted `workplan` into `implementation_execution`
  - [ ] align implementation-plan output artifacts with implementation-execution input needs
  - [ ] align trace and review semantics with shared runner behavior
  - [ ] focused tests for handoff and runtime alignment

### Step 6. Deliver `implementation_execution` Stage

- [x] Step 6 is in progress
- [x] Architecture modules in scope
  - [x] `Execution/ImplementationGenerator`
  - [x] `Contract/ImplementationContract`
  - [x] `Workflow/ImplementationStageRunner`
- [ ] Batch 1: implementation execution vertical slice
  - [x] `ImplementationGenerator` prototype
  - [x] implementation prompt builder prototype
  - [x] change parsing
  - [x] planned change output
  - [x] runnable tests for the vertical slice
- [ ] Batch 2: implementation execution contract and runner backbone
  - [x] `ImplementationContract`
  - [x] `ImplementationStageRunner`
  - [ ] implementation contract-check prompt construction
  - [ ] real `ILlmExecutor`-based implementation contract execution
  - [ ] real `LlmExecutionResult` to `ContractCheckResult` mapping
  - [x] implementation execution vertical slice through `generate -> contract -> review -> apply`
- [ ] Batch 3: implementation execution-context loading
  - [ ] introduce workplan-aware execution-context loading for `ImplementationGenerator`
  - [ ] load `implementation_workplan` and `current_step` as required runtime input
  - [ ] load upstream `requirement_document` and `architecture_document` into implementation generation input
  - [ ] load all relevant `module_design_documents` for the current execution step
  - [ ] extend tests for execution-context loading and prompt input completeness
- [ ] Batch 4: execution-environment contract validation
  - [ ] make `ImplementationContract` validate implementation-execution generated changes in a prepared execution environment
  - [ ] apply generated changes into prepared validation workspace before test execution
  - [ ] isolate validation workspace lifecycle from user workspace
  - [ ] extend tests for prepared-environment success and failure cases
- [ ] Batch 5: implementation execution runner persistence and trace
  - [ ] persist implementation-stage artifacts after successful runner completion
  - [ ] record trace for stage start
  - [ ] record trace for contract result
  - [ ] record trace for gate result
  - [ ] record trace for final step result
  - [ ] extend tests for artifact persistence and trace flow
- [ ] Batch 6: execution review and runtime semantics alignment
  - [ ] support review `comment`
  - [ ] align plan-step review outcomes with next-step transition semantics
  - [ ] align step execution input with workplan-driven context loading
  - [ ] remove residual single-module execution assumptions
  - [ ] fully align implementation-plan and implementation-execution semantics with design docs
  - [ ] extend tests for comment-aware review outcomes
- [ ] Batch 7: implementation-execution design and runtime alignment cleanup
  - [ ] align `Execution/ImplementationGenerator` design doc with the current implementation transition state
  - [ ] remove outdated single-module assumptions from docs and runtime naming
  - [ ] update this execution plan after each completed implementation batch

### Step 7. Deliver `validation` Stage

- [ ] Step 7 is not started
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
  - [ ] review whether `ValidationContract` needs prompt-shaped request and real `ILlmExecutor` execution tasks
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

### Step 8. Align Runtime Semantics With Design Docs

- [ ] Step 8 is not started
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

### Step 9. Extend Toward Agent Capabilities

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
- [x] Step 2 is in progress
- [x] Step 3 is in progress
- [x] Step 4 is in progress
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
