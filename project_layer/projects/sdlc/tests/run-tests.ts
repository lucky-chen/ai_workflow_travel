import { runArchitectureStageRunnerTests } from "./architecture-stage-runner.test.js";
import { runArtifactStoreTests } from "./artifact-store.test.js";
import { runArchitectureDesignGeneratorTests } from "./architecture-design-generator.test.js";
import { runArchitectureDesignContractTests } from "./architecture-design-contract.test.js";
import { runChangeGateTests } from "./change-gate.test.js";
import { runCliTests } from "./cli.test.js";
import { runImplementationContractTests } from "./implementation-contract.test.js";
import { runImplementationPlanGeneratorTests } from "./implementation-plan-generator.test.js";
import { runImplementationGeneratorTests } from "./implementation-generator.test.js";
import { runImplementationStageRunnerTests } from "./implementation-stage-runner.test.js";
import { runHistoryStoreTests } from "./history-store.test.js";
import { runLlmExecutorTests } from "./llm-executor.test.js";
import { runModuleDesignContractTests } from "./module-design-contract.test.js";
import { runModuleDesignFanoutTests } from "./module-design-fanout.test.js";
import { runModuleDesignGeneratorTests } from "./module-design-generator.test.js";
import { runModuleStageRunnerTests } from "./module-stage-runner.test.js";
import { runPipelineCoreTests } from "./pipeline-core.test.js";
import { runPipelineHandoffTests } from "./pipeline-handoff.test.js";
import { runPipelineStageEntryTests } from "./pipeline-stage-entry.test.js";
import { runRequirementContractTests } from "./requirement-contract.test.js";
import { runRequirementGeneratorTests } from "./requirement-generator.test.js";
import { runRequirementStageRunnerTests } from "./requirement-stage-runner.test.js";
import { createTempDir } from "./pipeline-test-helpers.js";
import { runTraceTests } from "./trace.test.js";

async function main(): Promise<void> {
  const pipelineWorkspaceRoot = await createTempDir("pipeline-workspace-");
  await runArtifactStoreTests();
  await runArchitectureDesignGeneratorTests();
  await runArchitectureDesignContractTests();
  await runArchitectureStageRunnerTests();
  await runChangeGateTests();
  await runCliTests();
  await runHistoryStoreTests();
  await runImplementationContractTests();
  await runImplementationPlanGeneratorTests();
  await runImplementationGeneratorTests();
  await runImplementationStageRunnerTests();
  await runLlmExecutorTests();
  await runModuleDesignContractTests();
  await runModuleDesignFanoutTests();
  await runModuleDesignGeneratorTests();
  await runModuleStageRunnerTests();
  await runPipelineCoreTests(pipelineWorkspaceRoot);
  await runPipelineStageEntryTests(pipelineWorkspaceRoot);
  await runPipelineHandoffTests(pipelineWorkspaceRoot);
  await runRequirementContractTests();
  await runRequirementGeneratorTests();
  await runRequirementStageRunnerTests();
  await runTraceTests();
  process.stdout.write("All tests passed.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
