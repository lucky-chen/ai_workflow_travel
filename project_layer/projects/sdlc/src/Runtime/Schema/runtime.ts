import type { StringMap } from "./common.js";
import type { WorkspaceLocalEnvConfig } from "../workspace-local-env.js";

export interface RuntimeRequest {
  mode: "compose";
  composeMode: "standard" | "from";
  entryUnit?: string;
  params?: StringMap;
}

export interface RuntimeContext {
  workspaceRoot: string;
  runId: string;
  workspaceLocalEnv: WorkspaceLocalEnvConfig;
}

export interface RuntimeInput {
  request: RuntimeRequest;
  context: RuntimeContext;
}

export interface RuntimeResult {
  accepted: boolean;
  summary: string;
}
