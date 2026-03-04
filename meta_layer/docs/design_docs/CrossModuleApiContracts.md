# Cross-Module API Contracts

## 1. Purpose

This document defines the minimal cross-module APIs needed to understand the workflow runtime collaboration.

It is used to:

- show which module calls which module during pipeline execution
- clarify the API boundary between major modules
- keep the overall architecture understandable

This document does not define detailed request fields, response fields, or storage contracts.

## 2. API List By Interaction Step

### 2.1 Start Task

- `Interface/CLI.launchTask(request) -> task_id`
- `Workflow/Pipeline.launchTask(request) -> task_id`

Notes:

- `launchTask` is the workflow entry API.
- resume and retry are represented as launch variants, not separate APIs.

### 2.2 Execute Stage

- `Execution/RequirementInterpreter.runStage(request) -> stage_output`
- `Execution/ArchitectureDesignGenerator.runStage(request) -> stage_output`
- `Execution/ModuleDesignGenerator.runStage(request) -> stage_output`
- `Execution/ImplementationGenerator.runStage(request) -> stage_output`
- `Execution/ValidationRunner.runStage(request) -> stage_output`

Notes:

- `Pipeline` only depends on the generic `runStage` shape.
- which concrete execution module is used is decided by stage registration, not by hard-coded pipeline logic.

### 2.3 Shared LLM Execution

- `Execution/RequirementInterpreter -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Execution/ArchitectureDesignGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Execution/ModuleDesignGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Execution/ImplementationGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Contract/* -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Other eligible modules -> SDK/LlmExecutor.execute(request) -> llm_result`

Notes:

- `SDK/LlmExecutor` is a shared llm execution capability.
- upstream modules provide prompt input and receive model result output.
- agent design and model selection are hidden behind the `SDK/LlmExecutor` boundary.

### 2.4 Check Stage Result

- `Contract/RequirementContract.checkStage(request) -> check_result`
- `Contract/ArchitectureDesignContract.checkStage(request) -> check_result`
- `Contract/ModuleDesignContract.checkStage(request) -> check_result`
- `Contract/ImplementationContract.checkStage(request) -> check_result`

Notes:

- contract check is optional per stage.
- contract success does not replace review.

### 2.5 Review And Decision

- `QualityGate/ChangeGate.review(request) -> gate_decision`

Notes:

- `Pipeline` uses the gate decision to continue, stop, or wait for review.

### 2.6 Trace And Visibility

- `QualityGate/Trace.recordTrace(request) -> event_ref`

Notes:

- trace is used to expose task progress and key stage events.
- this document only covers the trace API needed by workflow understanding.

## 3. Boundary Rules

- `Interface/CLI` only calls `Workflow/Pipeline`.
- `Workflow/Pipeline` orchestrates `Execution/*`, `Contract/*`, and `QualityGate/*`.
- `Pipeline` should not directly know concrete business-stage semantics.
- `Execution/*`, `Contract/*`, and `QualityGate/*` do not orchestrate stage progression.
- storage module CRUD APIs are out of scope for this document unless they are needed to explain the workflow collaboration.

## 4. Open Items

- Detailed request and response fields should be defined in each module design document where implementation needs them.
- If later the architecture needs workflow-visible storage interactions, those APIs can be added back here at a lightweight level.
