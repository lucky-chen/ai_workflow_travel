import { runApplicationTests } from "./app/application.test.js";
import { runArchitectureDesignCapabilityTests } from "./Capability/ArchitectureDesign/architecture-design.test.js";
import { runRequirementDesignCapabilityTests } from "./Capability/RequirementDesign/requirement-design.test.js";
import { runArtifactStoreTests } from "./shared/artifact-store.test.js";
import { runChangeGateTests } from "./shared/change-gate.test.js";
import { runCliTests } from "./cli.test.js";
import { runHistoryStoreTests } from "./shared/history-store.test.js";
import { runOrchestratorTests } from "./runtime/orchestrator.test.js";
import { runLlmExecutorTests } from "./shared/llm-executor.test.js";
import { runTraceTests } from "./shared/trace.test.js";
import { runWorkspaceLocalEnvTests } from "./shared/workspace-local-env.test.js";

async function main(): Promise<void> {
  await runArtifactStoreTests();
  await runChangeGateTests();
  await runCliTests();
  await runApplicationTests();
  await runOrchestratorTests();
  await runRequirementDesignCapabilityTests();
  await runArchitectureDesignCapabilityTests();
  await runHistoryStoreTests();
  await runLlmExecutorTests();
  await runTraceTests();
  await runWorkspaceLocalEnvTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
