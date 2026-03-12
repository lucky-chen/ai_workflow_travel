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

- `meta_layer/resources/COLLABORATION_STANDARD.md`

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
- [x] Batch 3: implementation plan stage runner flow
  - [x] `ImplementationPlanStageRunner`
  - [x] direct binding creation inside `ImplementationPlanStageRunner`
  - [x] `generate -> contract -> review` main flow
  - [x] persist accepted `workplan`
  - [x] implementation-plan trace recording in runner
  - [x] implementation-plan gate review flow
  - [x] focused tests for runner and stage flow
- [x] Batch 4: implementation-plan runtime alignment
  - [x] handoff accepted `workplan` into `implementation_execution`
  - [x] align implementation-plan output artifacts with implementation-execution input needs
  - [x] align trace and review semantics with shared runner behavior
  - [x] focused tests for handoff and runtime alignment

### Step 6. Deliver `implementation_execution` Stage

- [ ] Step 6 is in progress
- [x] Architecture modules in scope
  - [x] `Execution/ImplementationGenerator`
  - [x] `Contract/ImplementationContract`
  - [x] `Workflow/ImplementationStageRunner`
- [x] Batch 1: implementation execution vertical slice
  - [x] `ImplementationGenerator` prototype
  - [x] implementation prompt builder prototype
  - [x] change parsing
  - [x] planned change output
  - [x] runnable tests for the vertical slice
- [x] Batch 2: implementation execution contract and runner backbone
  - [x] `ImplementationContract`
  - [x] `ImplementationStageRunner`
  - [x] implementation execution vertical slice through `generate -> contract -> review -> apply`
  - [x] implementation execution environment preparation
  - [x] shell or unit-test runner execution
  - [x] test-run result to `ContractCheckResult` mapping
  - [x] align contract naming and public API with the implementation-contract design doc
  - [x] keep `ImplementationContract.check(...)` scoped to generated-result validation only
- [x] Batch 3: implementation execution-context loading
  - [x] validate `implementation_workplan` and the current execution batch input before generator execution in `ImplementationStageRunner.run(...)`
  - [x] make `ImplementationPlanContract` parse accepted `implementation_workplan` markdown into a structured workplan
  - [x] assemble the current execution batch context inside `ImplementationStageRunner`
  - [x] pass the contract-produced structured workplan into `ImplementationGenerator`
  - [x] load upstream `requirement_document` and `architecture_document` into implementation generation input
  - [x] load all relevant `module_design_documents` for the current execution batch
  - [x] pass runner-prepared batch context into `ImplementationGenerator`
  - [x] extend tests for explicit workplan-batch context before generator execution
  - [x] extend tests for parsed workplan handoff and prompt input completeness
- [x] Batch 4: execution-environment contract validation
  - [x] apply generated changes into the target project workspace before test execution
  - [x] make `ImplementationContract` validate the applied implementation-execution result by running the configured test script in the target project workspace
  - [x] present validated changes to user review only after contract test passes
  - [x] update the accepted implementation plan state after user review accepts the validated changes
  - [x] create one overall git commit after user review accepts the validated changes
  - [x] keep current file state and stop the task when user review rejects the validated changes
  - [x] extend tests for direct in-project execution success, validation failure, and review rejection stop semantics
- [ ] Batch 5: implementation execution runner persistence and trace
  - [x] persist implementation-stage artifacts after successful runner completion
  - [x] record trace for stage start
  - [x] record trace for contract result
  - [x] record trace for gate result
  - [x] record trace for final step result
  - [x] extend tests for artifact persistence and trace flow
- [ ] Batch 6: execution review and runtime semantics alignment
  - [x] support review `comment`
  - [x] support workflow-level multi-step execution across one `implementation_workplan`
  - [x] iterate ordered workplan batches inside each step in `ImplementationStageRunner`
  - [x] persist and resume `current_batch` between stage-entry runs
  - [x] align plan-step and plan-batch review outcomes with runner-managed next-batch and next-step transition semantics
  - [x] stop `implementation_execution` when all workplan batches are completed
  - [x] align batch execution input with runner-managed workplan context loading
  - [x] remove residual single-module execution assumptions
  - [x] fully align implementation-plan and implementation-execution semantics with design docs
  - [x] extend tests for comment-aware review outcomes
- [ ] Batch 7: implementation-execution design and runtime alignment cleanup
  - [x] align `Execution/ImplementationGenerator` design doc with the current implementation transition state
  - [x] align `Contract/ImplementationContract` design doc with the current implementation transition state
  - [x] keep `ImplementationStageRunner` public input and transition surface versionable while using `SDK/AgentRuntime` as a V1 single-turn backbone
  - [x] remove outdated single-module assumptions from docs and runtime naming
  - [x] keep workflow-level multi-step continuation inside `ImplementationStageRunner` for V1 even when `SDK/AgentRuntime` is used underneath
  - [x] update this execution plan after each completed implementation batch

### Step 7. Deliver `validation` Stage

- [x] Step 7 is completed
- [x] Architecture modules in scope
  - [x] `Workflow/ValidationStageRunner`
- [x] Batch 1: validation input and result model
  - [x] final validation input shape
  - [x] validation-stage output shape
  - [x] validation summary and issue model
  - [x] minimal tests for validation input and output shaping
- [x] Batch 2: validation execution backbone
  - [x] final workspace validation checks
  - [x] final artifact completeness checks
  - [x] project-path loading and shell-test execution flow
  - [x] shell-test result shaping
  - [x] focused tests for validation execution success and failure
- [x] Batch 3: validation stage runner flow
  - [x] `ValidationStageRunner`
  - [x] direct `run -> review` main flow
  - [x] validation review flow
  - [x] validation artifact persistence
  - [x] validation trace flow
  - [x] focused tests for runner and stage flow
- [x] Batch 4: validation-stage runtime alignment
  - [x] load implementation-stage artifacts as validation input
  - [x] align validation completion semantics with pipeline task completion
  - [x] align validation review semantics with CLI presentation
  - [x] confirm final-stage completion behavior

### Step 8. Align Runtime Semantics With Design Docs

- [x] Step 8 is in progress
- [x] Documents and modules in scope
  - [x] `Execution/ImplementationGenerator`
  - [x] `Contract/ImplementationContract`
  - [x] `Workflow/Pipeline`
  - [x] `Workflow/StageRunners`
  - [x] `QualityGate/ChangeGate`
  - [x] `QualityGate/Trace`
  - [x] `Interface/CLI`
- [x] Batch 1: runtime gap inventory
  - [x] compare implemented behavior with architecture documents
  - [x] compare implemented behavior with module design documents
  - [x] identify semantic mismatches in stage transitions and contracts
  - [x] record required code and document updates
  - [x] Gap inventory summary
    - [x] `Workflow/Pipeline` design doc is behind the current shared contract surface and runtime API naming (`triggerReason`, `inputArtifacts`, `params`, `TaskRuntimeStore`, and current `StageOutput` shape).
    - [x] `PipelineService` is no longer fully generic because it contains built-in `module_design` continuation logic; Batch 2 needs to decide whether to generalize that continuation model or document it more explicitly in shared runner semantics.
    - [x] `Workflow/Pipeline` design doc still says pipeline must not hard-code business-stage identifiers, which conflicts with the current `architecture_design -> module_design` special case in runtime code.
    - [x] shared stage-runner behavior is mostly aligned for document stages, but `validation` remains a deliberate exception and `implementation_execution` now exposes runner-managed continuation state (`current_step`, completion signal) that is not yet reflected in `Pipeline.md`.
    - [x] trace taxonomy is only partially standardized; current runtime emits `task_started`, `stage_started`, `contract_checked`, `gate_reviewed`, `artifact_persisted`, `validation_finished`, `stage_failed`, `task_finished`, and implementation-specific completion events without one consolidated contract source.
    - [x] `QualityGate/ChangeGate` runtime supports review `comment`, but presenter and CLI-facing review workflow are still narrower than the CLI design doc examples.
    - [x] `Interface/CLI` design doc and runtime implementation are materially misaligned: the design doc describes multi-input stage launches and review commands, while the current CLI still supports only a minimal `generate --module --input --workspace` path.
    - [x] `Execution/ImplementationGenerator` and `Contract/ImplementationContract` were aligned in Step 6/7, so the remaining Step 8 work is mainly in shared workflow, trace, gate, and CLI semantics rather than implementation-stage internals.
- [x] Batch 2: pipeline and stage-runner alignment
  - [x] align pipeline generic orchestration semantics
  - [x] align stage-runner shared behavior model
  - [x] align stage continuation and retry semantics
  - [x] extend tests for orchestration behavior
  - [x] register `architecture_design -> module_design` fan-out continuation in the production composition root
- [x] Batch 3: contract, trace, and gate alignment
  - [x] align implementation runtime semantics
  - [x] align contract runtime semantics
  - [x] align trace persistence semantics
  - [x] align gate presenter and review semantics
  - [x] extend tests for contract, trace, and review flows
  - [x] align validation-stage `gate_reviewed` trace metadata with shared review comment semantics
  - [x] centralize document-stage `contract_checked` and `artifact_persisted` trace helpers in `BaseStageRunner`
  - [x] align review presenter/session semantics with `changedPaths` and stable `reviewId` display
  - [x] define a shared `TraceEventType` taxonomy and move production trace emitters to shared constants
  - [x] pin the contract boundary: `implementation_execution` emits failed `contract_checked`, while `validation` remains a no-contract exception
  - [x] pin implementation failure paths so reject and wait reviews never emit completion semantics
### Step 9. Align CLI And MCP Runtime Baseline

- [x] Step 9 is completed
- [x] Documents and modules in scope
  - [x] `Interface/CLI`
  - [x] `SDK/AgentRuntime`
  - [x] `SDK/LlmExecutor`
  - [x] runtime-to-document synchronization
- [x] Batch 1: CLI launch baseline
  - [x] align CLI interaction semantics
  - [x] converge CLI launch input to `workspace` as the single project root input
  - [x] keep review as runtime-inline CLI interaction and do not introduce a standalone `review` command
  - [x] remove explicit CLI artifact-path arguments from the baseline launch flow
  - [x] add CLI-declared `single-step` execution mode and stop after the current stage when it is requested
  - [x] support `init` to copy bundled SDLC resources into `workspace/sdlc/resources`
  - [x] cover workspace-rooted launch behavior in CLI tests
- [x] Batch 2: workspace path and artifact layout alignment
  - [x] make stage input loading resolve required artifacts from the workspace directory layout instead of explicit CLI artifact arguments
  - [x] make template and contract loading prefer `workspace/sdlc/resources` and fall back to bundled `dist/resources`
  - [x] move `implementation_workplan` off the hard-coded `plans/implementation/...` path and resolve it from a runner-owned `workspaceRoot` convention
  - [x] redirect document-stage outputs into `workspace/sdlc/docs`
  - [x] pin `implementation_execution` generated code target to `workspace/src`
  - [x] converge validation runtime input from `project_path` into `workspace`
  - [x] extend runner and validation tests for the new workspace-rooted path rules
- [x] Batch 3: design-doc and sequence synchronization
  - [x] sync `Interface/CLI.md` with workspace-rooted launch semantics and runtime-inline review behavior
  - [x] sync `Workflow/StageRunners.md` with `workspace/sdlc/docs`, `workspace/src`, and workspace-rooted validation semantics
  - [x] sync `SystemInteractionDesign.md` with workspace-driven input loading and output path conventions
  - [x] sync architecture-level path semantics only where the current architecture doc still reflects the old layout assumptions
  - [x] update sequence diagrams affected by runtime changes
  - [x] update plan status to reflect true implementation state
  - [x] confirm docs and runnable behavior are consistent
- [x] Batch 4: MCP baseline alignment
  - [x] sync MCP baseline design intent across `SDK/AgentRuntime`, `SDK/LlmExecutor`, and `SystemInteractionDesign`
  - [x] expand `SDK/AgentRuntime` design to cover MCP baseline plus the forward-compatible session/memory/multi-turn evolution model
  - [x] add MCP protocol support to `AgentRuntime`
  - [x] add file read/write as the default MCP-backed tool capability
  - [x] promote MCP support into stable runtime planning, execution, and trace semantics
  - [x] `IMcpGateway`
  - [x] MCP request/result types
  - [x] tool-capable execution plan steps
  - [x] executor support for MCP tool calls
  - [x] trace events for tool call and tool result
  - [x] tests for MCP-enabled execution

### Step 10. Validate Baseline With `hello-service`

- [ ] Step 10 is in progress
- [x] Architecture modules in scope
  - [x] `SDK/AgentRuntime`
  - [x] `SDK/LlmExecutor`
  - [x] workflow automation on top of completed stages
  - [x] `hello-service` verification target
- [x] Batch 1: hello-service baseline target preparation
  - [x] create or prepare one minimal `hello-service` target
  - [x] baseline evidence is automated in `tests/hello-service/hello-service-baseline.test.ts`
  - [x] verification currently uses a temporary hello-service workspace rather than a committed sample app under `user_projects/hello-service`
- [x] Batch 2: hello-service baseline capability black-box verification
  - [x] verify the CLI can launch from `workspace` without explicit artifact path arguments
  - [x] verify document artifacts are produced under `workspace/sdlc/docs`
  - [x] verify `implementation_execution` targets `workspace/src`
  - [x] verify validation runs against `workspace`
  - [x] capture validation evidence for the runnable backbone
- [x] Batch 3: hello-service mock-LLM call-chain verification
  - [x] verify hello-service baseline flow produces observable `SDK/LlmExecutor` call evidence under mock-LLM execution
  - [x] verify llm call evidence covers document generation stages under mock-LLM execution
  - [x] verify llm call evidence covers implementation generation flow under mock-LLM execution
  - [x] verify the recorded llm-call evidence remains assertable from persisted history output under mock-LLM execution
- [x] Batch 4: hello-service mock-LLM artifact verification
  - [x] verify document-generation artifacts remain stable under mock-LLM execution
  - [x] verify implementation-generation artifacts remain stable under mock-LLM execution
  - [x] verify the combined simple-project artifacts remain aligned under mock-LLM execution
- [x] Batch 5: hello-service real-LLM call-chain verification
  - [x] add a real LLM-backed verification path for hello-service
  - [x] verify the hello-service black-box flow produces observable real-LLM module call evidence
  - [x] verify `requirement_interpretation` call-chain evidence stays aligned between real-LLM and mock execution
  - [x] verify `architecture_design` call-chain evidence stays aligned between real-LLM and mock execution
  - [x] verify `module_design` call-chain evidence stays aligned between real-LLM and mock execution
  - [x] verify `implementation_plan` call-chain evidence stays aligned between real-LLM and mock execution
  - [x] verify `implementation_execution` call-chain evidence stays aligned between real-LLM and mock execution
- [ ] Batch 6: hello-service real-LLM artifact verification
  - [ ] verify document-generation artifacts remain aligned with the mock-LLM verification target under real LLM execution
  - [ ] verify implementation-generation artifacts remain aligned with the mock-LLM verification target under real LLM execution
  - [ ] verify the recorded real-LLM evidence remains assertable from persisted history output
- [x] Batch 7: hello-service simple-project workflow and contract verification
  - [x] verify contract success allows the hello-service workflow to continue through downstream stages
  - [x] verify contract-failure injection stops stage progression at the failed stage
  - [x] verify downstream artifacts are not produced after contract failure
  - [x] verify contract success/failure leaves reviewable persisted history evidence
- [ ] Batch 8: hello-service simple-project functional verification
  - [x] separate baseline workflow verification from hello-service functional verification
  - [x] require shell-based implementation contract and validation instead of mock shell pass-through
  - [x] verify the generated hello-service implementation covers the current simple-project behavior
  - [x] verify the generated workspace documents stay mutually aligned around the simple hello-service scope
  - [x] verify validation output confirms the simple hello-service target remains runnable
  - [x] verify persisted history captures the hello-service functional verification results

### Step 12. Extend Toward Agent Capabilities

- [ ] Step 12 is not started
- [ ] Architecture modules in scope
  - [ ] `SDK/AgentRuntime`
  - [ ] `SDK/LlmExecutor`
  - [ ] workflow automation on top of completed stages
- [ ] Batch 1: AgentRuntime V2 session-aware runtime
  - [x] session-aware design baseline documented in `SDK/AgentRuntime.md`
  - [ ] `AgentSession` and `AgentMessage` runtime types
  - [ ] `IAgentSessionStore`
  - [ ] session load/save flow in `IAgent`
  - [ ] session-aware trace metadata
  - [ ] tests for session creation, load, update, and save
- [ ] Batch 2: AgentRuntime V2 memory support
  - [x] memory design baseline documented in `SDK/AgentRuntime.md`
  - [ ] `AgentMemory` runtime model
  - [ ] memory update rules across agent runs
  - [ ] memory-aware planner inputs
  - [ ] memory-aware executor inputs
  - [ ] tests for memory persistence and memory-driven execution
- [ ] Batch 3: AgentRuntime V2 multi-turn semantics
  - [x] multi-turn design baseline documented in `SDK/AgentRuntime.md`
  - [ ] step-based execution plan model
  - [ ] richer `ObservationResult` decisions (`accept` / `continue` / `abort`)
  - [ ] bounded multi-iteration agent loop
  - [ ] stop-condition and continuation policies
  - [ ] tests for multi-turn continuation and stop conditions
- [ ] Batch 4: SDLC integration on top of AgentRuntime V2
  - [ ] `LlmExecutor` adaptation to session-aware runtime
  - [ ] MCP-enabled llm execution facade path
  - [ ] migrate `ImplementationStageRunner` continuation model into AgentRuntime-managed multi-turn sessions without breaking the V1 stage API
  - [ ] workflow-stage integration points for agent-assisted execution
  - [ ] richer workflow automation after core stages are complete
  - [ ] integration tests across `SDK/LlmExecutor` and `SDK/AgentRuntime`

### Step 13. Deliver Stage-Local Document Revision Capability

- [ ] Step 13 is not started
- [ ] Architecture modules in scope
  - [ ] `Interface/CLI`
  - [ ] `Workflow/Pipeline`
  - [ ] `Workflow/StageRunners`
  - [ ] `Execution/DocumentStageGenerator`
  - [ ] `Contract/*`
  - [ ] `QualityGate/ChangeGate`
  - [ ] `Data/ArtifactStore`
- [ ] Batch 1: revision workflow and runner input assembly
  - [ ] add revision-stage CLI request assembly with `commit` message input
  - [ ] register revision `StageDefinition` entries in `Workflow/Pipeline`
  - [ ] implement revision runner input assembly for `canonicalArtifactPath`, `revisedArtifactPath`, and upstream `inputArtifacts`
  - [ ] keep template and contract resource bindings canonical in revision mode
- [ ] Batch 2: document generator revise-mode support
  - [ ] extend `DocumentStageGenerator` to support `revise` mode alongside `generate`
  - [ ] make revise mode read the canonical current artifact and write the revised candidate to `dist/sdlc/revision/{taskId}/{runId}/revised.md`
  - [ ] keep multi-turn interaction delegated to the underlying agent capability
  - [ ] keep generator output aligned with the canonical stage `StageOutput.artifacts` shape
- [ ] Batch 3: architecture-design revision vertical slice
  - [ ] support `architecture_design` revision end-to-end with the existing architecture generator and contract
  - [ ] reuse `ArchitectureDesignContract` directly for revision-mode contract checks
  - [ ] overwrite `sdlc/docs/TechnicalArchitecture.md` only after review `apply`
  - [ ] cover success and failure behavior in focused tests
- [ ] Batch 4: document-stage revision generalization
  - [ ] extend the same revise-mode flow to `requirement_interpretation`
  - [ ] extend the same revise-mode flow to `module_design`
  - [ ] extend the same revise-mode flow to `implementation_plan`
  - [ ] confirm the shared revision flow keeps downstream stages untouched

### Step 14. Validate Expanded Baseline With `TravelAi`

- [ ] Step 14 is not started
- [ ] Architecture modules in scope
  - [ ] `SDK/AgentRuntime`
  - [ ] `SDK/LlmExecutor`
  - [ ] workflow automation on top of completed stages
  - [ ] `TravelAi` verification target
- [ ] Batch 1: `TravelAi` requirement and architecture expansion
  - [ ] define a richer `TravelAi` requirement target beyond the minimal hello baseline
  - [ ] define `TravelAi` architecture for the richer runtime flow and module boundaries
  - [ ] keep requirement and architecture artifacts aligned for `TravelAi`
  - [ ] keep the `TravelAi` target small enough for stable black-box verification
- [ ] Batch 2: `TravelAi` module design and implementation plan expansion
  - [ ] expand `TravelAi` module-design outputs to cover the richer service scope
  - [ ] evolve the implementation plan to reflect the expanded module and execution surface
  - [ ] keep module-design outputs aligned with architecture responsibilities and dependency boundaries
  - [ ] keep the implementation plan aligned with the expanded validation target
- [ ] Batch 3: `TravelAi` workflow, functional, and acceptance verification
  - [ ] verify the generated `TravelAi` implementation covers the expanded service behavior
  - [ ] verify the generated workspace documents stay mutually aligned around the expanded `TravelAi` scope
  - [ ] verify validation output confirms the expanded `TravelAi` target remains runnable
  - [ ] confirm `TravelAi` validates a more complete SDLC capability scope

### Deferred Architecture Modeling Todo

- [ ] define an `ArchitectureModel` intermediate artifact parsed from architecture documents
- [ ] model `layers` as first-class architecture descriptors
- [ ] model `modules` with explicit owning `layer`
- [ ] model `designItems` as architecture breakdown work items instead of assuming every item is a single module
- [ ] model `relationships` for layer-level and module-level dependency or interaction constraints
- [ ] make `architecture_design` emit the parsed architecture model alongside markdown artifacts
- [ ] make `module_design` consume structured design-item context instead of relying only on prose architecture input
- [ ] make `implementation_plan` consume the same structured design-item context to constrain plan scope and task splitting
- [ ] use the parsed architecture model in downstream validation and out-of-scope checks
- [ ] document the architecture-model parsing source mapping from `4.2`, `5.2`, `5.3`, and `7.2`

## 4. Current Status Summary

- [x] Step 1 has a usable V1 backbone
- [x] Step 2 is in progress
- [x] Step 3 is in progress
- [x] Step 4 is in progress
- [x] Step 5 is in progress
- [x] Step 6 is in progress
- [x] Step 7 is completed
- [x] Step 8 is in progress
- [x] Step 9 is completed
- [ ] Step 10 is in progress
- [ ] Step 12 is not started
- [ ] Step 13 is not started
- [ ] Step 14 is not started

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
