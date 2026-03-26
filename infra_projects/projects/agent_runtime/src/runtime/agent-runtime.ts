import { AgentRuntimeService } from "./agent-runtime-service.js";
import type {
  AgentRuntime,
  AgentRuntimeDependencies,
} from "./agent-runtime-types.js";

export * from "./agent-runtime-types.js";
export type { AgentTraceEvent, IAgentTraceRecorder } from "./agent-trace-recorder.js";
export { AgentRuntimeService } from "./agent-runtime-service.js";
export { AgentSessionManager } from "./agent-session-manager.js";
export { RuntimeAgentSession } from "./runtime-agent-session.js";

export function createAgentRuntime(dependencies: AgentRuntimeDependencies): AgentRuntime {
  return new AgentRuntimeService(dependencies);
}
