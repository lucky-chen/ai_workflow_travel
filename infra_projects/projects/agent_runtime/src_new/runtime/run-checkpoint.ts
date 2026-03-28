import { randomUUID } from "node:crypto";

import type { Storage } from "../data/storage.js";

export interface RunCheckpoint {
  capture(input: RunCheckpointInput): Promise<RunCheckpointState>;
}

export interface RunCheckpointInput {
  sessionId: string;
  runId: string;
  stepIndex: number;
  recoveryMetadata: RunRecoveryMetadata;
}

export interface RunCheckpointState {
  sessionId: string;
  runId: string;
  stepIndex: number;
  recoveryMetadata: RunRecoveryMetadata;
}

export interface RunRecoveryMetadata {
  resumeToken: string;
  capturedAt: string;
}

export class ReservedRunCheckpoint implements RunCheckpoint {
  constructor(private readonly storage: Storage) {}

  async capture(input: RunCheckpointInput): Promise<RunCheckpointState> {
    const state: RunCheckpointState = {
      ...input,
    };
    await this.storage.save(`checkpoints/${input.sessionId}/${input.runId}/${input.stepIndex}`, state as unknown as Record<string, unknown>);
    return state;
  }
}

export function createRecoveryMetadata(): RunRecoveryMetadata {
  return {
    resumeToken: randomUUID(),
    capturedAt: new Date().toISOString(),
  };
}
