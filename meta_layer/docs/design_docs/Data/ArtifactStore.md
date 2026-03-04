# ArtifactStore Design

## 1. Goal

### 1.1 Purpose

Define the module design of `Data/ArtifactStore`.

### 1.2 Involved Modules

This module design directly involves:

- `Data/ArtifactStore`

This module design collaborates with:

- `Workflow/Pipeline`
- `Contract/*`
- `QualityGate/ChangeGate`

### 1.3 Core Functions

`Data/ArtifactStore` is the artifact persistence module.

Its core functions are:

- persist artifact files
- return stable artifact references
- load stored artifact files
- query artifacts by task and stage

`ArtifactStore` does not decide workflow progression, contract validity, or gate approval result.

## 2. Core Classes

### 2.1 Class Diagram

```plantuml
@startuml
interface IArtifactStore {
  +writeArtifact(request: WriteArtifactRequest): ArtifactRef
  +getArtifact(ref: ArtifactRef): ArtifactContent
  +listArtifacts(query: ArtifactQuery): ArtifactRef[]
}

class ArtifactStoreService {
  -contentStore: ArtifactContentStore
}

class ArtifactContentStore

IArtifactStore <|.. ArtifactStoreService
ArtifactStoreService --> ArtifactContentStore
@enduml
```

### 2.2 `ArtifactStoreService`

Role:

- module entry point
- owns artifact write/read orchestration

Responsibilities:

- expose artifact write API
- expose artifact read API
- expose artifact query API
- coordinate file storage and file lookup

### 2.3 `ArtifactContentStore`

Role:

- raw content persistence component

Responsibilities:

- persist artifact content
- load artifact content by ref

### 2.4 `IArtifactStore`

Role:

- abstract artifact persistence interface

Responsibilities:

- provide stable artifact write/read contract to upstream modules

## 3. Core Runtime Flow

### 3.1 Main Flow

```plantuml
@startuml
participant Caller as "Workflow/Pipeline or other caller"
participant IArtifactStore as "Data/IArtifactStore"
participant ArtifactStoreService as "Data/ArtifactStoreService"
participant ArtifactContentStore

Caller -> IArtifactStore: write/read request
IArtifactStore -> ArtifactStoreService: dispatch request

alt write artifact
  ArtifactStoreService -> ArtifactContentStore: write content
  ArtifactContentStore --> ArtifactStoreService: artifact_ref
  ArtifactStoreService --> Caller: artifact_ref
else get artifact
  ArtifactStoreService -> ArtifactContentStore: get content
  ArtifactContentStore --> ArtifactStoreService: artifact_content
  ArtifactStoreService --> Caller: artifact_content
else list artifacts
  ArtifactStoreService -> ArtifactContentStore: list refs by query
  ArtifactContentStore --> ArtifactStoreService: artifact_refs
  ArtifactStoreService --> Caller: artifact_refs
end
@enduml
```

## 4. Detailed Design

### 4.1 Core Model

```ts
type ArtifactRef = string
```

### 4.2 Core APIs And Fields

#### 4.2.1 Public API

```ts
interface IArtifactStore {
  writeArtifact(request: WriteArtifactRequest): ArtifactRef
  getArtifact(ref: ArtifactRef): ArtifactContent
  listArtifacts(query: ArtifactQuery): ArtifactRef[]
}
```

#### 4.2.2 Write And Query Types

```ts
interface WriteArtifactRequest {
  task_id?: string
  stage_id?: string
  file_name: string
  content: ArtifactContent
}

interface ArtifactQuery {
  task_id?: string
  stage_id?: string
}
```

#### 4.2.3 Content Types

```ts
interface ArtifactContent {
  format: string
  body: string
}
```

### 4.3 Storage Shape

```text
artifact_store/
  {task_id}/
    {stage_id}/
      {artifact_ref}_{file_name}
```

### 4.4 Constraints

- `ArtifactStore` must not decide whether an artifact is valid.
- `ArtifactStore` must not decide whether an artifact should be approved or applied.
- the storage model should stay caller-agnostic.
- `ArtifactStore` only stores files.
- `ArtifactStore` should remain queryable by task and stage.
