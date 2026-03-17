import assert from "node:assert/strict";

import { ApplicationService, createApplication } from "../../src/Runtime/application.js";
import type { Orchestrator } from "../../src/Runtime/Orchestrator/index.js";
import type { RuntimeInput } from "../../src/Runtime/Schema/runtime.js";

export async function runApplicationTests(): Promise<void> {
  await testCreateApplicationBuildsRuntimeEntry();
  await testApplicationServiceSupportsDirectOrchestratorInjection();
}

async function testCreateApplicationBuildsRuntimeEntry(): Promise<void> {
  const application = createApplication();
  assert.equal(typeof application.run, "function");
  await assert.rejects(
    async () => application.run({
      request: {
        mode: "compose",
        composeMode: "standard",
      },
      context: {
        workspaceRoot: "/tmp/project",
        runId: "run-1",
      },
    }),
    /runtime orchestration boundary is available/,
  );
}

async function testApplicationServiceSupportsDirectOrchestratorInjection(): Promise<void> {
  let capturedInput: RuntimeInput | undefined;
  const orchestrator: Orchestrator = {
    async run(input: RuntimeInput) {
      capturedInput = input;
      return {
        accepted: true,
        summary: "ok",
      };
    },
  };

  const application = new ApplicationService(orchestrator);
  const input: RuntimeInput = {
    request: {
      mode: "compose",
      composeMode: "standard",
    },
    context: {
      workspaceRoot: "/tmp/project",
      runId: "run-2",
    },
  };

  const result = await application.run(input);
  assert.deepEqual(capturedInput, input);
  assert.deepEqual(result, {
    accepted: true,
    summary: "ok",
  });
}
