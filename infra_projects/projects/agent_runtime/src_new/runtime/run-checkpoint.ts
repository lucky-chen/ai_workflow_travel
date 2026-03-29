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
  enabled?: boolean;
  reasonCode?: string;
}

export class RunCheckpoint implements RunCheckpoint {
  constructor(private readonly _storage: Storage) {}

  async capture(input: RunCheckpointInput): Promise<RunCheckpointState> {
    return {
      ...input,
      recoveryMetadata: {
        ...input.recoveryMetadata,
        enabled: false,
        reasonCode: "RUN_CHECKPOINT_NOT_ENABLED",
      },
    };
  }
}

export function createRecoveryMetadata(): RunRecoveryMetadata {
  return {
    resumeToken: randomUUID(),
    capturedAt: new Date().toISOString(),
  };
}
