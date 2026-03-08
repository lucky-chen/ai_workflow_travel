# System Interaction Design

## 0. Reading Guide

Recommended order:

1. Read [TechnicalArchitecture.md](../TechnicalArchitecture.md) for architecture boundaries and stage flow.
2. Read this document for cross-module calls and stage collaboration.
3. Follow linked module docs only when implementation details are needed.

Interface source index (single source of truth):

- `Workflow/Pipeline` entry and stage orchestration:
  - [Workflow/Pipeline.md](./Workflow/Pipeline.md)
  - [Workflow/StageRunners.md](./Workflow/StageRunners.md)
- `Execution/*` stage execution interfaces:
  - [Execution/RequirementGenerator.md](./Execution/RequirementGenerator.md)
  - [Execution/ArchitectureDesignGenerator.md](./Execution/ArchitectureDesignGenerator.md)
  - [Execution/ModuleDesignGenerator.md](./Execution/ModuleDesignGenerator.md)
  - [Execution/ImplementationGenerator.md](./Execution/ImplementationGenerator.md)
- `Contract/*` stage check interfaces:
  - [Contract/ArchitectureDesignContract.md](./Contract/ArchitectureDesignContract.md)
  - [Contract/ModuleDesignContract.md](./Contract/ModuleDesignContract.md)
  - [Contract/ImplementationContract.md](./Contract/ImplementationContract.md)
  - [Contract/ValidationContract.md](./Contract/ValidationContract.md)
- `QualityGate/*` decision and trace interfaces:
  - [QualityGate/ChangeGate.md](./QualityGate/ChangeGate.md)
  - [QualityGate/Trace.md](./QualityGate/Trace.md)
- Shared execution SDK:
  - [SDK/AgentRuntime.md](./SDK/AgentRuntime.md)
  - [SDK/LlmExecutor.md](./SDK/LlmExecutor.md)

Minimal shared shapes used in this document:

- `context`: stage runtime context passed from `Workflow/Pipeline`.
- `output`: stage payload used for check/review (usually produced by `Execution/*`, or loaded from upstream artifacts when execution binding is not used).
- `check_result`: contract check result returned by `Contract/*`.
- `gate_decision`: review decision returned by `QualityGate/ChangeGate`.

## 1. Purpose

This document defines the minimal cross-module APIs needed to understand the workflow runtime collaboration.

Document path note: this document is currently stored as `design_docs/SystemInteractionDesign.md`.

It is used to:

- show which module calls which module during pipeline execution
- clarify the API boundary between major modules
- bridge architecture-level flow and downstream module-level design documents
- keep the overall architecture understandable

This document does not define detailed request fields, response fields, or storage contracts.

Placeholder note:

- `Execution/RequirementGenerator` is an approved empty implementation placeholder; it stays bound to the requirement stage but may keep pass-through generation behavior unless explicitly expanded later.
- `Execution/ModuleDesignGenerator` is an approved reuse placeholder with explicit `CODEGEN_REUSE_SPEC`; codegen should resolve it via its declared reuse source and overrides, not treat it as missing design.

## 2. API List By Interaction Step

### 2.1 Start Task

- `Interface/CLI.run(argv) -> exit_code`
- `Workflow/Pipeline.launchTask(request) -> task_id`

Notes:

- `launchTask` is the workflow entry API.
- resume and retry are represented as launch variants, not separate APIs.

### 2.2 Execute Stage

- `Execution/RequirementGenerator.run(context) -> stage_output`
- `Execution/ArchitectureDesignGenerator.run(context) -> stage_output`
- `Execution/ModuleDesignGenerator.run(context) -> stage_output`
- `Execution/ImplementationGenerator.run(context) -> stage_output`

Notes:

- `Pipeline` depends on shared stage APIs (`run` for execution modules, `check` for contract modules).
- which concrete execution module is used is decided by stage registration, not by hard-coded pipeline logic.

### 2.3 Shared LLM Execution

- `Execution/RequirementGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Execution/ArchitectureDesignGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Execution/ModuleDesignGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Execution/ImplementationGenerator -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Contract/* -> SDK/LlmExecutor.execute(request) -> llm_result`
- `Other eligible modules -> SDK/LlmExecutor.execute(request) -> llm_result`

Notes:

- `SDK/LlmExecutor` is a shared llm execution capability.
- `SDK/AgentRuntime` owns the reusable internal agent execution loop used by `SDK/LlmExecutor`.
- upstream modules provide prompt input and receive model result output.
- agent design and model selection are hidden behind the `SDK/LlmExecutor` boundary.

### 2.4 Check Stage Result

- `Contract/RequirementContract.check(context, output) -> check_result`
- `Contract/ArchitectureDesignContract.check(context, output) -> check_result`
- `Contract/ModuleDesignContract.check(context, output) -> check_result`
- `Contract/ImplementationContract.check(context, output) -> check_result`
- `Contract/ValidationContract.check(context, output) -> check_result`

Notes:

- contract check is optional per stage.
- validation stage uses `Contract/ValidationContract.check` as validation confirmation input.
- contract success does not replace review.

### 2.5 Review And Decision

- `QualityGate/ChangeGate.review(request) -> gate_decision`

Notes:

- `Pipeline` uses the gate decision to continue, stop, or wait for review.
- validation stage should call `QualityGate/ChangeGate` to confirm final validation success/failure information.

### 2.6 Trace And Visibility

- `QualityGate/Trace.recordTrace(event) -> event_ref`

Notes:

- trace is used to expose task progress and key stage events.
- this document only covers the trace API needed by workflow understanding.

## 3. End-to-End Stage Collaboration

Stage composition mapping and per-stage runner flow are defined in [Workflow/StageRunners.md](./Workflow/StageRunners.md) as the single source of truth.

### 3.3 Failure And Retry Semantics

- execution failure in any stage: stage becomes `failed`, pipeline stops at current stage.
- contract failure in contract-enabled stages: stage becomes `failed` unless retried with corrected input/output.
- gate reject in any stage (including validation final result confirmation): stage becomes `failed`.
- retry strategy: restart from the failed stage when required upstream inputs are available.

## 4. Boundary Rules

- `Interface/CLI` only calls `Workflow/Pipeline`.
- `Workflow/Pipeline` orchestrates `Execution/*`, `Contract/*`, and `QualityGate/*`.
- `Pipeline` should not directly know concrete business-stage semantics.
- `Execution/*`, `Contract/*`, and `QualityGate/*` do not orchestrate stage progression.
- storage module CRUD APIs are out of scope for this document unless they are needed to explain the workflow collaboration.

## 5. Open Items

- Detailed request and response fields should be defined in each module design document where implementation needs them.
- If later the architecture needs workflow-visible storage interactions, those APIs can be added back here at a lightweight level.
- This document should reference interface sources instead of redefining module-local interface details.
