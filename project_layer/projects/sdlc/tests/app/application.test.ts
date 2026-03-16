import assert from "node:assert/strict";

import { createApplication } from "../../src/Runtime/application.js";
import type { RuntimeInput } from "../../src/Runtime/Schema/runtime.js";

export async function runApplicationTests(): Promise<void> {
  await testCreateApplicationBuildsRuntimeEntry();
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
        workspaceLocalEnv: {},
      },
    }),
    /Compose-run is not implemented yet/,
  );
}
