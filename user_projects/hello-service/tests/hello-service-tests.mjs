import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const helloServiceRoot = path.resolve(path.dirname(currentFilePath), "..");
const helloServiceTestsRoot = path.join(helloServiceRoot, "tests");

const HELLO_SERVICE_TEST_REGISTRY = {
  runtime: [
    implementedEntry(
      "runtime:document-generation:success",
      "Minimal document generation runtime flow.",
      "hello-service-document-generation-flow.test.mjs",
      "runHelloServiceFunctionalTest",
    ),
    implementedEntry(
      "runtime:document-generation:failure",
      "Runtime failure path for document generation flow.",
      "hello-service-document-generation-flow-failure.test.mjs",
      "runHelloServiceDocumentGenerationFailureTest",
    ),
    implementedEntry(
      "runtime:document-generation:real-llm:success",
      "Real LLM success path for document generation flow.",
      "hello-service-document-generation-real-llm.test.mjs",
      "runHelloServiceDocumentGenerationRealLlmTest",
    ),
    unimplementedEntry(
      "runtime:document-generation:real-llm:failure",
      "Real LLM failure path for document generation flow.",
    ),
    implementedEntry(
      "runtime:unit-flow:success",
      "Full unit runtime success flow.",
      "hello-service-unit-flow-success.test.mjs",
      "runHelloServiceSuccessTest",
    ),
    implementedEntry(
      "runtime:unit-flow:failure",
      "Runtime failure path for full unit flow.",
      "hello-service-unit-flow-failure.test.mjs",
      "runHelloServiceUnitFlowFailureTest",
    ),
    implementedEntry(
      "runtime:unit-flow:real-llm:success",
      "Real LLM success path for full unit flow.",
      "hello-service-real-llm-unit-flow.test.mjs",
      "runHelloServiceRealLlmTest",
    ),
    unimplementedEntry(
      "runtime:unit-flow:real-llm:failure",
      "Real LLM failure path for full unit flow.",
    ),
    implementedEntry(
      "runtime:baseline:success",
      "Baseline runtime aggregation flow.",
      "hello-service-baseline.test.mjs",
      "runHelloServiceBaselineTest",
    ),
    implementedEntry(
      "runtime:baseline:failure",
      "Baseline runtime failure aggregation flow.",
      "hello-service-baseline-failure.test.mjs",
      "runHelloServiceBaselineFailureTest",
    ),
    implementedEntry(
      "runtime:external-update-loop:success",
      "Requirement update external mcp loop success path.",
      "hello-service-external-update-loop-success.test.mjs",
      "runHelloServiceExternalUpdateLoopSuccessTest",
    ),
    unimplementedEntry(
      "runtime:baseline:real-llm:success",
      "Baseline aggregation with real LLM success path.",
    ),
    unimplementedEntry("runtime:baseline:real-llm:failure", "Baseline aggregation with real LLM failure path."),
  ],
  generator: [
    implementedEntry(
      "generator:requirement-design:success",
      "Requirement design generator success cases.",
      "hello-service-requirement-generator-success.test.mjs",
      "runHelloServiceRequirementGeneratorSuccessTest",
    ),
    implementedEntry(
      "generator:requirement-design:failure",
      "Requirement design generator failure cases.",
      "hello-service-requirement-generator-failure.test.mjs",
      "runHelloServiceRequirementGeneratorFailureTest",
    ),
    implementedEntry(
      "generator:requirement-design:real-llm:success",
      "Requirement design generator real LLM success cases.",
      "hello-service-requirement-generator-real-llm.test.mjs",
      "runHelloServiceRequirementGeneratorRealLlmTest",
    ),
    unimplementedEntry("generator:requirement-design:real-llm:failure", "Requirement design generator real LLM failure cases."),
    implementedEntry(
      "generator:architecture-design:success",
      "Architecture design generator success cases.",
      "hello-service-architecture-generator-success.test.mjs",
      "runHelloServiceArchitectureGeneratorSuccessTest",
    ),
    implementedEntry(
      "generator:architecture-design:failure",
      "Architecture design generator failure cases.",
      "hello-service-architecture-generator-failure.test.mjs",
      "runHelloServiceArchitectureGeneratorFailureTest",
    ),
    implementedEntry(
      "generator:architecture-design:real-llm:success",
      "Architecture design generator real LLM success cases.",
      "hello-service-architecture-generator-real-llm.test.mjs",
      "runHelloServiceArchitectureGeneratorRealLlmTest",
    ),
    unimplementedEntry("generator:architecture-design:real-llm:failure", "Architecture design generator real LLM failure cases."),
    implementedEntry(
      "generator:item-design:success",
      "Item design generator success cases.",
      "hello-service-item-design-generator-success.test.mjs",
      "runHelloServiceItemDesignGeneratorSuccessTest",
    ),
    implementedEntry(
      "generator:item-design:failure",
      "Item design generator failure cases.",
      "hello-service-item-design-generator-failure.test.mjs",
      "runHelloServiceItemDesignGeneratorFailureTest",
    ),
    implementedEntry(
      "generator:item-design:real-llm:success",
      "Item design generator real LLM success cases.",
      "hello-service-item-design-generator-real-llm.test.mjs",
      "runHelloServiceItemDesignGeneratorRealLlmTest",
    ),
    unimplementedEntry("generator:item-design:real-llm:failure", "Item design generator real LLM failure cases."),
    implementedEntry(
      "generator:work-plan:success",
      "Work plan generator success cases.",
      "hello-service-work-plan-generator-success.test.mjs",
      "runHelloServiceWorkPlanGeneratorSuccessTest",
    ),
    implementedEntry(
      "generator:work-plan:failure",
      "Work plan generator failure cases.",
      "hello-service-work-plan-generator-failure.test.mjs",
      "runHelloServiceWorkPlanGeneratorFailureTest",
    ),
    implementedEntry(
      "generator:work-plan:real-llm:success",
      "Work plan generator real LLM success cases.",
      "hello-service-work-plan-generator-real-llm.test.mjs",
      "runHelloServiceWorkPlanGeneratorRealLlmTest",
    ),
    unimplementedEntry("generator:work-plan:real-llm:failure", "Work plan generator real LLM failure cases."),
    implementedEntry(
      "generator:work-execute:success",
      "Work execute generator success cases.",
      "hello-service-work-execute-generator-success.test.mjs",
      "runHelloServiceWorkExecuteGeneratorSuccessTest",
    ),
    implementedEntry(
      "generator:work-execute:failure",
      "Work execute generator failure cases.",
      "hello-service-work-execute-generator-failure.test.mjs",
      "runHelloServiceWorkExecuteGeneratorFailureTest",
    ),
    implementedEntry(
      "generator:work-execute:real-llm:success",
      "Work execute generator real LLM success cases.",
      "hello-service-work-execute-generator-real-llm.test.mjs",
      "runHelloServiceWorkExecuteGeneratorRealLlmTest",
    ),
    unimplementedEntry("generator:work-execute:real-llm:failure", "Work execute generator real LLM failure cases."),
  ],
  contract: [
    implementedEntry(
      "contract:requirement-design:success",
      "Requirement design contract success cases.",
      "hello-service-requirement-contract-success.test.mjs",
      "runHelloServiceRequirementContractSuccessTest",
    ),
    implementedEntry(
      "contract:requirement-design:failure",
      "Requirement design contract failure cases.",
      "hello-service-requirement-contract-failure.test.mjs",
      "runHelloServiceRequirementContractFailureTest",
    ),
    implementedEntry(
      "contract:requirement-design:real-llm:success",
      "Requirement design contract real LLM success cases.",
      "hello-service-requirement-contract-real-llm.test.mjs",
      "runHelloServiceRequirementContractRealLlmTest",
    ),
    unimplementedEntry("contract:requirement-design:real-llm:failure", "Requirement design contract real LLM failure cases."),
    implementedEntry(
      "contract:architecture-design:success",
      "Architecture design contract success cases.",
      "hello-service-architecture-contract-success.test.mjs",
      "runHelloServiceArchitectureContractSuccessTest",
    ),
    implementedEntry(
      "contract:architecture-design:failure",
      "Architecture design contract failure cases.",
      "hello-service-architecture-contract-failure.test.mjs",
      "runHelloServiceContractFailureTest",
    ),
    implementedEntry(
      "contract:architecture-design:real-llm:success",
      "Architecture design contract real LLM success cases.",
      "hello-service-architecture-contract-real-llm.test.mjs",
      "runHelloServiceArchitectureContractRealLlmTest",
    ),
    unimplementedEntry("contract:architecture-design:real-llm:failure", "Architecture design contract real LLM failure cases."),
    implementedEntry(
      "contract:item-design:success",
      "Item design contract success cases.",
      "hello-service-item-design-contract-success.test.mjs",
      "runHelloServiceItemDesignContractSuccessTest",
    ),
    implementedEntry(
      "contract:item-design:failure",
      "Item design contract failure cases.",
      "hello-service-item-design-contract-failure.test.mjs",
      "runHelloServiceItemDesignContractFailureTest",
    ),
    implementedEntry(
      "contract:item-design:real-llm:success",
      "Item design contract real LLM success cases.",
      "hello-service-item-design-contract-real-llm.test.mjs",
      "runHelloServiceItemDesignContractRealLlmTest",
    ),
    unimplementedEntry("contract:item-design:real-llm:failure", "Item design contract real LLM failure cases."),
    implementedEntry(
      "contract:overall-design:success",
      "Overall design contract success cases.",
      "hello-service-overall-design-contract-success.test.mjs",
      "runHelloServiceOverallDesignContractSuccessTest",
    ),
    implementedEntry(
      "contract:overall-design:failure",
      "Overall design contract failure cases.",
      "hello-service-overall-design-contract-failure.test.mjs",
      "runHelloServiceOverallDesignContractFailureTest",
    ),
    unimplementedEntry("contract:overall-design:real-llm:success", "Overall design contract real LLM success cases."),
    unimplementedEntry("contract:overall-design:real-llm:failure", "Overall design contract real LLM failure cases."),
    implementedEntry(
      "contract:work-plan:success",
      "Work plan contract success cases.",
      "hello-service-work-plan-contract-success.test.mjs",
      "runHelloServiceWorkPlanContractSuccessTest",
    ),
    implementedEntry(
      "contract:work-plan:failure",
      "Work plan contract failure cases.",
      "hello-service-work-plan-contract-failure.test.mjs",
      "runHelloServiceWorkPlanContractFailureTest",
    ),
    implementedEntry(
      "contract:work-plan:real-llm:success",
      "Work plan contract real LLM success cases.",
      "hello-service-work-plan-contract-real-llm.test.mjs",
      "runHelloServiceWorkPlanContractRealLlmTest",
    ),
    unimplementedEntry("contract:work-plan:real-llm:failure", "Work plan contract real LLM failure cases."),
    implementedEntry(
      "contract:work-execute:success",
      "Work execute contract success cases.",
      "hello-service-work-execute-contract-success.test.mjs",
      "runHelloServiceWorkExecuteContractSuccessTest",
    ),
    implementedEntry(
      "contract:work-execute:failure",
      "Work execute contract failure cases.",
      "hello-service-work-execute-contract-failure.test.mjs",
      "runHelloServiceWorkExecuteContractFailureTest",
    ),
    unimplementedEntry("contract:work-execute:real-llm:success", "Work execute contract real LLM success cases."),
    unimplementedEntry("contract:work-execute:real-llm:failure", "Work execute contract real LLM failure cases."),
  ],
};

export async function runHelloServiceTest(mode) {
  const entries = HELLO_SERVICE_TEST_REGISTRY[mode];
  if (!entries) {
    throw new Error(`Unsupported hello-service test mode: ${String(mode)}`);
  }

  await runImplementedEntries(entries);
  reportUnimplementedEntries(mode, entries);
}

function implementedEntry(id, summary, scriptFileName, exportName) {
  return {
    id,
    summary,
    status: "implemented",
    scriptFileName,
    exportName,
  };
}

function unimplementedEntry(id, summary) {
  return {
    id,
    summary,
    status: "unimplemented",
  };
}

async function runImplementedEntries(entries) {
  for (const entry of entries) {
    if (entry.status !== "implemented") {
      continue;
    }

    await loadTestRunner(entry.scriptFileName, entry.exportName);
  }
}

function reportUnimplementedEntries(mode, entries) {
  const pendingEntries = entries.filter((entry) => entry.status === "unimplemented");
  if (pendingEntries.length === 0) {
    return;
  }

  process.stdout.write(`Unimplemented ${mode} test entries:\n`);
  for (const entry of pendingEntries) {
    process.stdout.write(`- ${entry.id}: ${entry.summary}\n`);
  }
}

async function loadTestRunner(scriptFileName, exportName) {
  const scriptModule = await import(pathToFileURL(path.join(helloServiceTestsRoot, scriptFileName)).href);
  const testRunner = scriptModule[exportName];
  if (typeof testRunner !== "function") {
    throw new Error(`Missing exported test runner "${exportName}" in ${scriptFileName}.`);
  }

  await testRunner();
}

async function main() {
  const mode = process.argv[2];
  if (!mode) {
    throw new Error("Missing required hello-service test mode.");
  }

  await runHelloServiceTest(mode);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
