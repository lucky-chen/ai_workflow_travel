# Code Generation Execution Plan

## 1. Purpose

This document is the execution checklist for moving `project_layer` from architecture skeleton to runnable code generation workflow.

Follow it from larger tasks to smaller tasks. When one task is complete, mark it as checked.

## 2. Overall Development Phases

### What is already ready

- [x] `meta_layer` design documents exist
- [x] `project_layer` TypeScript project skeleton exists
- [x] shared contracts and module skeletons exist
- [x] TypeScript typecheck baseline passes

### What still needs to be built

- [ ] real local artifact persistence
- [ ] real project context loading
- [ ] real file change application
- [ ] real workflow orchestration
- [ ] real CLI launch flow
- [ ] real contract-based validation

### Stage sequencing

- [ ] Build the first runnable vertical slice:
  `CLI -> Pipeline -> ImplementationGenerator -> ArtifactStore / LlmExecutor -> StageOutput`
- [ ] After the vertical slice is stable, add contract validation
- [ ] After contract validation is stable, add trace and review capabilities

## 3. Working Rules

- [ ] Prefer one runnable vertical slice over many incomplete module shells
- [ ] Stabilize shared contracts before expanding implementations
- [ ] Use local-file implementations first
- [ ] Keep code aligned with `meta_layer` design boundaries
- [ ] Do not mark a task complete unless it is verifiable

## 4. Phase-by-Phase Task Checklist

### Phase 1: Stabilize Shared Contracts

Large task goal:

- [x] Make core interfaces stable enough for real implementations

Files in scope:

- [x] `src/shared/contracts/pipeline.ts`
- [x] `src/shared/contracts/artifact-store.ts`
- [x] `src/shared/contracts/llm-executor.ts`
- [x] `src/shared/contracts/trace.ts`
- [x] `src/shared/contracts/change-gate.ts`
- [x] `src/shared/types/common.ts`

Subtasks:

- [x] Review naming across task, stage, artifact, and output types
- [x] Normalize naming inconsistencies
- [x] Confirm required vs optional fields in core contracts
- [x] Reduce ambiguity in `StageRunContext`
- [x] Reduce ambiguity in `StageOutput`
- [x] Remove placeholder-style fields from core execution types
- [x] Keep interfaces implementation-oriented and minimal

Completion checklist:

- [x] Shared contract files compile cleanly
- [x] Downstream modules can implement against contracts without guessing missing shape

### Phase 2: Implement Local `ArtifactStore`

Large task goal:

- [x] Support real artifact persistence for upstream and downstream stages

Files in scope:

- [x] `src/data/artifact-store/artifact-store.ts`

Subtasks:

- [x] Define storage root strategy
- [x] Document storage root handling in code comments or adjacent docs
- [x] Implement `writeArtifact`
- [x] Implement `getArtifact`
- [x] Implement `listArtifacts`
- [x] Persist by `taskId/stageId/filePath`
- [x] Ensure directory creation is deterministic
- [x] Handle missing artifact reads with explicit behavior

Tests and verification:

- [x] Add tests for artifact write behavior
- [x] Add tests for artifact read behavior
- [x] Add tests for artifact list behavior
- [x] Verify deterministic local file layout

Completion checklist:

- [x] Artifacts can be written and read locally
- [x] `listArtifacts` can query by root directory

### Phase 3: Implement `ImplementationGenerator` V1

Large task goal:

- [x] Turn a module design artifact into real generated file changes

Files in scope:

- [x] `src/execution/implementation-generator/implementation-generator.ts`

Subtasks:

- [x] Implement `ModuleDesignLoader` with real artifact loading
- [x] Define module design artifact lookup rules
- [x] Implement `ProjectContextLoader`
- [x] Add workspace scanning logic
- [x] Add relevant file selection logic
- [x] Define project context size boundary for V1
- [x] Implement `ImplementationPromptBuilder`
- [x] Make prompt input structured and stable
- [x] Make requested output shape explicit in prompt
- [x] Implement `ChangeApplier`
- [x] Parse structured `changed_files` output
- [x] Apply create operations to disk
- [x] Apply update operations to disk
- [x] Apply delete operations to disk
- [x] Return stable `ApplyResult`
- [x] Implement `StageOutputBuilder`
- [x] Keep `ImplementationGeneratorService` as the orchestration entry

Tests and verification:

- [x] Add tests for module design loading
- [x] Add tests for project context loading
- [x] Add tests for change parsing
- [x] Add tests for file apply behavior
- [x] Add one end-to-end test using mock LLM output

Completion checklist:

- [x] Generator can load module design input from artifact store
- [x] Generator can inspect the target workspace
- [x] Generator can apply generated file changes to disk
- [x] Generator returns stable `StageOutput`

### Phase 4: LlmExecutor Delivery

Large task goal:

- [ ] Deliver LLM execution in two steps: switchable foundation first, then real provider integration

- [x] Phase 4.1 completes the switchable mock-first foundation
- [ ] Phase 4.2 completes real provider integration for OpenAI and DeepSeek

### Phase 4.1: Switchable `LlmExecutor` Foundation

Large task goal:

- [x] Support deterministic local testing and a switchable executor skeleton

Files in scope:

- [x] `src/sdk/llm-executor/llm-executor.ts`
- [x] `src/sdk/llm-executor/llm-executor-factory.ts`
- [x] `src/sdk/llm-executor/mock-llm-executor.ts`
- [x] `src/sdk/llm-executor/noop-real-llm-executor.ts`

Subtasks:

- [x] Keep one mock implementation for local development
- [x] Define provider adapter boundary behind `ILlmExecutor`
- [x] Add one real provider adapter
- [x] Separate request shaping from provider invocation
- [x] Normalize provider output into `LlmExecutionResult`
- [x] Define executor selection strategy for V1

Tests and verification:

- [x] Add tests for mock executor behavior
- [x] Add tests for request-in/result-out normalization

Completion checklist:

- [x] Project runs with mock executor without external dependency
- [x] Project can switch to a real provider without changing generator logic

### Phase 4.2: Real Provider Skeleton And Model Selection

Large task goal:

- [x] Prepare the real-provider skeleton and optional model selection flow

Files in scope:

- [x] `src/sdk/llm-executor/llm-executor.ts`
- [x] `src/sdk/llm-executor/llm-executor-factory.ts`
- [x] `src/sdk/llm-executor/noop-real-llm-executor.ts`
- [x] shared real-provider helper files under `src/sdk/llm-executor`

Subtasks:

- [x] Define provider configuration shape for real execution
- [x] Read provider mode from runtime configuration or environment variables
- [x] Define optional model selection shape for real execution
- [x] Define shared HTTP request boundary for future provider adapters
- [x] Add a real-provider execution skeleton behind `ILlmExecutor`
- [x] Handle missing API key and invalid configuration with explicit errors
- [x] Handle unsupported provider mode with explicit errors
- [x] Keep mock mode as the default local development path

Tests and verification:

- [x] Add tests for provider selection logic
- [x] Add tests for optional model selection behavior
- [x] Add tests for real-provider skeleton request handling
- [x] Add tests for missing credential behavior
- [x] Verify mock mode remains stable after real-provider skeleton integration

Completion checklist:

- [x] Project can select between mock mode and real-provider mode
- [x] Project can carry optional model configuration into the real-provider path
- [x] Real-provider skeleton does not break mock-based local testing

### Phase 4.3: Real Provider Smoke Validation

Large task goal:

- [x] Integrate and validate real network execution against OpenAI and DeepSeek

Files in scope:

- [x] `src/sdk/llm-executor/llm-executor.ts`
- [x] `src/sdk/llm-executor/llm-executor-factory.ts`
- [x] provider adapter files under `src/sdk/llm-executor`
- [x] `package.json`
- [x] integration validation files under `tests`

Subtasks:

- [x] Implement OpenAI provider adapter
- [x] Map OpenAI request shape from `LlmExecutionRequest`
- [x] Normalize OpenAI response into `LlmExecutionResult`
- [x] Implement DeepSeek provider adapter
- [x] Map DeepSeek request shape from `LlmExecutionRequest`
- [x] Normalize DeepSeek response into `LlmExecutionResult`
- [x] Define opt-in integration validation entry for OpenAI
- [x] Define opt-in integration validation entry for DeepSeek
- [x] Read provider credentials from environment variables
- [x] Read provider base URL and model from environment variables
- [x] Execute one minimal real prompt against OpenAI
- [x] Execute one minimal real prompt against DeepSeek
- [x] Verify provider response can be normalized into `LlmExecutionResult`
- [x] Verify invalid credential or endpoint errors are explicit
- [x] Keep integration validation out of default `npm test`

Tests and verification:

- [x] Add one OpenAI integration validation command
- [x] Add one DeepSeek integration validation command
- [x] Document required environment variables for local execution
- [x] Verify default unit test flow still runs without network access

Completion checklist:

- [x] OpenAI smoke validation can pass with valid credentials
- [x] DeepSeek smoke validation can pass with valid credentials
- [x] Mock and unit tests remain runnable without network access

### Phase 5: Implement Minimal `PipelineService`

Large task goal:

- [ ] Support launching and running one real stage through shared workflow entry

Files in scope:

- [ ] `src/workflow/pipeline/pipeline.ts`

Subtasks:

- [ ] Define minimal runtime task creation flow
- [ ] Implement `launchTask`
- [ ] Construct `StageRunContext`
- [ ] Support one registered stage runner or stage generator
- [ ] Capture and return stage output
- [ ] Keep the design open for later stage registry expansion

Tests and verification:

- [ ] Add tests for one successful launch flow
- [ ] Add tests for invalid input handling if included in V1

Completion checklist:

- [ ] Pipeline can launch one stage successfully
- [ ] Stage execution result is returned in stable form

### Phase 6: Implement Minimal CLI Entry

Large task goal:

- [ ] Allow command-line triggering of one implementation generation workflow

Files in scope:

- [ ] `src/interface/cli/cli.ts`

Subtasks:

- [ ] Define initial command shape
- [ ] Parse one minimal `generate` command
- [ ] Parse `--module`
- [ ] Parse `--input`
- [ ] Parse `--workspace`
- [ ] Map parsed args to `LaunchTaskRequest`
- [ ] Invoke `IPipeline`
- [ ] Print task start message
- [ ] Print final result summary

Suggested initial command:

- [ ] `generate --module implementation --input <artifact-path> --workspace <path>`

Tests and verification:

- [ ] Add tests for command parsing
- [ ] Add tests for request mapping
- [ ] Add tests for CLI success flow

Completion checklist:

- [ ] User can trigger one implementation generation flow from CLI
- [ ] CLI output is readable and stable

### Phase 7: Implement `ImplementationContract` V1

Large task goal:

- [ ] Validate generated implementation output with one runnable test command

Files in scope:

- [ ] `src/contract/implementation-contract/implementation-contract.ts`

Subtasks:

- [ ] Implement `ExecutionEnvironmentPreparer`
- [ ] Define one V1 test command strategy
- [ ] Implement `ITestRunner`
- [ ] Execute one unit-test command for changed code
- [ ] Convert runtime result into `ContractCheckResult`
- [ ] Normalize pass/fail issue output

Tests and verification:

- [ ] Add tests for pass outcome
- [ ] Add tests for fail outcome
- [ ] Add tests for issue conversion

Completion checklist:

- [ ] Generated implementation can be validated by contract module
- [ ] Test failures produce structured issues

### Phase 8: Add Trace And Review Capabilities

Large task goal:

- [ ] Make workflow execution visible and reviewable

Files in scope:

- [ ] `src/shared/contracts/trace.ts`
- [ ] `src/shared/contracts/change-gate.ts`
- [ ] future implementations under `src/quality-gate`

Subtasks:

- [ ] Implement trace event recording
- [ ] Define minimal review request shape
- [ ] Implement minimal change review abstraction
- [ ] Expose key progress points
- [ ] Expose key decision points

Tests and verification:

- [ ] Add tests for trace event recording if implementation is added
- [ ] Add tests for review request and decision flow if implementation is added

Completion checklist:

- [ ] Stage progress is traceable
- [ ] Reviewable change summary is available for gate integration

## 5. Recommended Order

- [ ] Complete Phase 1
- [ ] Complete Phase 2
- [ ] Complete Phase 3
- [ ] Complete Phase 4
- [ ] Complete Phase 4.1
- [ ] Complete Phase 4.2
- [ ] Complete Phase 4.3
- [ ] Complete Phase 5
- [ ] Complete Phase 6
- [ ] Complete Phase 7
- [ ] Complete Phase 8

## 6. Verification Rule For Every Task

- [ ] Run `tsc` before marking a phase complete
- [ ] Add or update focused tests before marking a phase complete
- [ ] Record what is now truly runnable before moving to the next phase
- [ ] Do not move on if the current phase only adds placeholders

## 7. How To Use This Document

- [ ] Pick one unchecked subtask
- [ ] Implement it end to end
- [ ] Run typecheck and relevant tests
- [ ] Check the completed items
- [ ] Update this plan only if the implementation strategy materially changes
