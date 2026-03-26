import path from "node:path";

export function resolveAgentRuntimeStorageRoot(workdir: string): string {
  return path.join(workdir, ".agent_runtime");
}

export function createRuntimeTraceFileId(now = new Date()): string {
  const iso = now.toISOString().replace(/[-:.]/g, "").replace(/\.\d+Z$/, "Z");
  return `${iso}-${Math.random().toString(36).slice(2, 8)}`;
}

export function resolveRuntimeTracePath(workdir: string, traceFileId: string): string {
  return path.join(resolveAgentRuntimeStorageRoot(workdir), `agent-runtime-trace-${traceFileId}.json`);
}

export function resolveSessionStatePath(workdir: string, sessionId: string): string {
  return path.join(resolveAgentRuntimeStorageRoot(workdir), "sessions", `${sessionId}.json`);
}

export function resolveSessionTranscriptPath(workdir: string, sessionId: string): string {
  return path.join(resolveAgentRuntimeStorageRoot(workdir), "transcripts", `${sessionId}.json`);
}

export function resolveMemoryPath(workdir: string, scope: string): string {
  return path.join(resolveAgentRuntimeStorageRoot(workdir), "runtime_memory", `${encodeURIComponent(scope)}.json`);
}

export function resolveWorkspaceLocalEnvPath(workdir: string): string {
  return path.join(workdir, "sdlc", "local_env.json");
}
