import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactStoreService } from "../src/data/artifact-store/artifact-store.js";
import {
  ChangeApplier,
  ImplementationGenerator,
  ImplementationGeneratorService,
  ImplementationPromptBuilder,
  ModuleDesignLoader,
  ProjectContextLoader,
  StageOutputBuilder,
} from "../src/execution/implementation-generator/implementation-generator.js";
import { LlmExecutorService } from "../src/sdk/llm-executor/llm-executor.js";

test("implementation generator returns structured stage output", async () => {
  const generator = new ImplementationGenerator(
    new ImplementationGeneratorService(
      new ModuleDesignLoader(new ArtifactStoreService()),
      new ProjectContextLoader(),
      new ImplementationPromptBuilder(),
      new LlmExecutorService(),
      new ChangeApplier(),
      new StageOutputBuilder(),
    ),
  );

  const output = await generator.run({
    taskId: "task-1",
    stageId: "implementation",
    workspaceRoot: "/tmp/project",
    inputArtifacts: {
      moduleDesign: "module-design.md",
    },
  });

  assert.equal(output.stageId, "implementation");
  assert.equal(output.success, true);
  assert.equal(typeof output.summary, "string");
  assert.deepEqual(output.artifacts.changedFiles, []);
});
