import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ExecutionContext } from "../../src/Runtime/Unit/execution-unit.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../src/SDK/AgentRuntime/LlmExecutor/llm-executor.js";

export async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function removeTempDir(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true });
}

export function createExecutionContext(
  workspaceRoot: string,
  executionUnitId: string,
  inputArtifacts: Record<string, string> = {},
): ExecutionContext {
  return {
    taskId: `${executionUnitId}-task`,
    runId: `${executionUnitId}-run`,
    executionUnitId,
    attempt: 1,
    workspaceRoot,
    inputArtifacts,
    params: {
      executionUnit: executionUnitId,
    },
  };
}

export function createMockLlmExecutor(
  execute: (request: LlmExecutionRequest) => Promise<LlmExecutionResult>,
): ILlmExecutor {
  return {
    async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
      return execute(request);
    },
  };
}
