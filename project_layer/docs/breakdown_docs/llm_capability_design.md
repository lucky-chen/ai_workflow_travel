# LlmCapability Design

## 0. Document Type

- type: `functional_group_design`
- scope: define the internal LLM adapter boundary and the external runtime capability reference boundary
- includes: `LlmExecutor`, `AgentRuntime`
- downstream usage: guide follow-up design for adapter normalization, capability-to-runtime collaboration, and external runtime reference linkage

## 1. Goal

### 1.1 Purpose

Define the internal adapter design for `LlmExecutor` and the external reference boundary for `AgentRuntime`.

### 1.2 Involved Items

This design document directly covers:

- `LlmExecutor`
- `AgentRuntime`

This design document collaborates with:

- `RequirementDesignGenerate`
- `ArchitectureDesignGenerate`
- `ItemDesignContract`
- `WorkExecuteContract`

### 1.3 Core Functions

`LlmCapability` is the design item for model-supported execution through one internal adapter plus one external runtime capability reference.

Its core functions are:

- Accept normalized model-execution requests from capability modules.
- Adapt internal requests into the external runtime capability boundary.
- Return stable model-execution results to capability callers.
- Keep external runtime dependency details behind a stable adapter boundary.

`LlmCapability` does not own business capability sequencing, artifact persistence, or review decisions.

## 2. Core Classes

### 2.1 Class Diagram

```plantuml
@startuml
interface LlmExecutorApi {
  +execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>
}

class LlmExecutor
class RuntimeRequestMapper
interface AgentRuntimeApi

LlmExecutorApi <|.. LlmExecutor
LlmExecutor --> RuntimeRequestMapper
LlmExecutor --> AgentRuntimeApi
@enduml
```

### 2.2 Core Class Responsibilities

#### 2.2.1 `LlmExecutor`

Role:

- Internal adapter between capability modules and external runtime capability.

Responsibilities:

- Accept normalized execution requests.
- Map internal request shape to external runtime request shape.
- Call `AgentRuntime`.
- Return normalized execution results to capability modules.

#### 2.2.2 `RuntimeRequestMapper`

Role:

- Request and result normalization helper.

Responsibilities:

- Convert internal request fields to runtime-compatible fields.
- Normalize runtime result shape for project callers.
- Isolate external boundary mapping from capability modules.

#### 2.2.3 `AgentRuntimeApi`

Role:

- External runtime capability boundary.

Responsibilities:

- Execute runtime requests.
- Return runtime execution results.
- Keep provider-specific details outside project capability modules.

## 3. Core Runtime Flow

### 3.1 Main Sequence Diagram

```plantuml
@startuml
participant Caller as "Capability/* caller"
participant LlmExecutor
participant AgentRuntime

Caller -> LlmExecutor: Execute model-supported request
LlmExecutor -> AgentRuntime: Forward normalized runtime request
AgentRuntime --> LlmExecutor: Return runtime result
LlmExecutor --> Caller: Return normalized model result
@enduml
```

## 4. Detailed Design

### 4.1 Core APIs And Types

#### 4.1.1 Public API

```typescript
interface LlmExecutorApi {
  execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>
}
```

#### 4.1.2 Input Types

```typescript
interface LlmExecutionRequest {
  operation: string
  payload: unknown
  metadata?: Record<string, string>
}
```

#### 4.1.3 Runtime Types

```typescript
interface AgentRuntimeRequest {
  operation: string
  payload: unknown
  metadata?: Record<string, string>
}

interface AgentRuntimeResult {
  status: "success" | "failed"
  payload: unknown
  diagnostics?: string[]
}
```

#### 4.1.4 Output Types

```typescript
interface LlmExecutionResult {
  status: "success" | "failed"
  payload: unknown
  diagnostics?: string[]
}
```

#### 4.1.5 Design-Item-Specific Rules

- Capability modules must call `LlmExecutor`, not `AgentRuntime`, directly.
- `LlmExecutor` must keep request and result normalization stable.
- External runtime replacement should not force capability-module API changes.
- The external runtime reference remains defined in [AgentRuntime](../design_docs/SDK/AgentRuntime.md).

### 4.2 Constraints

- `LlmExecutor` belongs to `Capability`.
- `AgentRuntime` belongs to `SDK`.
- Retry and provider-specific runtime policy remain outside this design document.
- LLM capability boundaries must remain separate from runtime orchestration and quality control.
