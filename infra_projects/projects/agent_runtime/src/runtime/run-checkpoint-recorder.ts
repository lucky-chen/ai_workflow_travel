import type { Storage } from "../data/storage.js";
import type { RunCheckpoint, RunCheckpointInput, RunCheckpointState } from "./run-checkpoint.js";

export class RunCheckpointRecorder implements RunCheckpoint {
  constructor(private readonly _storage: Storage) {}

  capture(input: RunCheckpointInput): Promise<RunCheckpointState> {
    return Promise.resolve({
      ...input,
      recoveryMetadata: {
        ...input.recoveryMetadata,
        enabled: false,
        reasonCode: "RUN_CHECKPOINT_NOT_ENABLED",
      },
    });
  }
}
