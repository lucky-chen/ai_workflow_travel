import { randomUUID } from "node:crypto";

import type { Storage } from "../data/storage.js";
import { RunCheckpointRecorder } from "./run-checkpoint-recorder.js";

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

export function createRunCheckpoint(storage: Storage): RunCheckpoint {
  return new RunCheckpointRecorder(storage);
}

export function createRecoveryMetadata(): RunRecoveryMetadata {
  return {
    resumeToken: randomUUID(),
    capturedAt: new Date().toISOString(),
  };
}
