import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertUnitLlmTrace,
  createWorkspaceCopy,
  getPrimaryItemDesignDocumentPath,
  loadTraceRecords,
  readJsonFile,
  removeWorkspace,
  resetWorkspace,
  runCli,
  writeArchitectureBreakdownFixture,
} from "./hello-service-test-helpers.mjs";

const realLlmTaskId = "hello-service-item-design-contract-real-llm-task";
const runId = "6000-item-design-contract-real-llm";

export async function runHelloServiceItemDesignContractRealLlmTest() {
  const targetWorkspaceRoot = await createWorkspaceCopy(runId);

  try {
    await resetWorkspace(targetWorkspaceRoot);
    await writeArchitectureBreakdownFixture(targetWorkspaceRoot);
    await writeItemDesignSemanticSuccessFixture(targetWorkspaceRoot);

    await runCli(
      targetWorkspaceRoot,
      ["run", "unit", "item_design_contract", "--document-path", await getPrimaryItemDesignDocumentPath(targetWorkspaceRoot)],
      { taskId: realLlmTaskId, runId, runtimeMode: "real" },
    );

    assertUnitLlmTrace(
      await loadTraceRecords(targetWorkspaceRoot, runId),
      { executionUnitId: "item_design_contract", runtimeMode: "real" },
    );

    const contractResult = await readJsonFile(
      path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "item_design_contract_result.json"),
    );
    assert.equal(contractResult.passed, true);
  } finally {
    await removeWorkspace(targetWorkspaceRoot);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runHelloServiceItemDesignContractRealLlmTest().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

async function writeItemDesignSemanticSuccessFixture(targetWorkspaceRoot) {
  const documentPath = path.join(targetWorkspaceRoot, await getPrimaryItemDesignDocumentPath(targetWorkspaceRoot));
  await mkdir(path.dirname(documentPath), { recursive: true });
  await writeFile(documentPath, ITEM_DESIGN_DOCUMENT, "utf8");
}

const ITEM_DESIGN_DOCUMENT = `# EchoService Design

## 1.1. Purpose

EchoService is the item that builds the stable hello-service response boundary and keeps the request-to-response behavior isolated from the rest of the workspace.

## 1.2. Involved Items

This item design directly involves:

- \`sdlc/docs/item_design/EchoService.md\`

This item design collaborates with:

- \`Requirement.md\`
- \`TechnicalArchitecture.md\`

## 1.3. Core Functions

\`EchoService\` is the request handling item for hello-service.

Its core functions are:

- validate the incoming hello request payload
- build the normalized greeting message
- expose one stable service method for the HTTP entry point
- return a small response object that downstream callers can serialize directly

\`EchoService\` does not manage persistence, background scheduling, or cross-service discovery.

## 2. Core Classes

## 2.1. Class Diagram

\`\`\`plantuml
@startuml
interface EchoServiceApi

class EchoService {
  +echo(input: EchoRequest): EchoResponse
}

class EchoRequestValidator {
  +validate(input: EchoRequest): EchoRequest
}

class GreetingFormatter {
  +format(name: string): string
}

EchoServiceApi <|.. EchoService
EchoService --> EchoRequestValidator
EchoService --> GreetingFormatter
@enduml
\`\`\`

## 2.2. Core Class Responsibilities

#### 2.2.1 \`EchoService\`

Role:

- orchestrate the primary request handling flow for hello-service

Responsibilities:

- accept the public request type
- call validation before business formatting
- return the stable response type used by the server endpoint

#### 2.2.2 \`EchoRequestValidator\`

Role:

- protect the service boundary from invalid request data

Responsibilities:

- require a non-empty caller name
- normalize whitespace around the caller name
- reject unsupported payload shapes before formatting starts

#### 2.2.3 \`GreetingFormatter\`

Role:

- build the deterministic greeting string for the validated caller name

Responsibilities:

- construct the final greeting message
- keep formatting rules in one place
- avoid leaking transport concerns into the service layer

## 3. Core Runtime Flow

## 3.1. Main Sequence Diagram

\`\`\`plantuml
@startuml
actor Client
participant ServerEndpoint
participant EchoService
participant EchoRequestValidator
participant GreetingFormatter

Client -> ServerEndpoint: POST /hello
ServerEndpoint -> EchoService: echo(input)
EchoService -> EchoRequestValidator: validate(input)
EchoRequestValidator --> EchoService: validatedInput
EchoService -> GreetingFormatter: format(validatedInput.name)
GreetingFormatter --> EchoService: greeting
EchoService --> ServerEndpoint: EchoResponse
ServerEndpoint --> Client: 200 response
@enduml
\`\`\`

## 4.1. Core APIs And Fields

## 4.1.1. Public API

\`\`\`typescript
interface IEchoService {
  echo(input: EchoRequest): EchoResponse
}
\`\`\`

## 4.1.2. Input Types

\`\`\`typescript
interface EchoRequest {
  name: string
  locale?: string
}

interface ContractSpec {
  document_contracts: DocumentContract[]
  section_contracts: SectionContract[]
}
\`\`\`

## 4.1.3. Runtime Types

\`\`\`typescript
interface ValidatedEchoRequest {
  name: string
  locale: string
}

type GreetingMessage = {
  text: string
}
\`\`\`

## 4.1.4. Output Types

\`\`\`typescript
interface EchoResponse {
  message: string
  requestId?: string
}
\`\`\`

## 4.1.5. Item-Specific Rules

- trim and validate the caller name before any formatting occurs
- default the locale to \`en-US\` when it is omitted
- always return the greeting text in the \`message\` field consumed by the server endpoint

## 4.2. Constraints

- keep the public API synchronous for the hello-service baseline
- do not couple the service logic to HTTP request or response objects
- keep response construction deterministic for contract and snapshot checks
- do not introduce storage or external network dependencies inside this item
`;
