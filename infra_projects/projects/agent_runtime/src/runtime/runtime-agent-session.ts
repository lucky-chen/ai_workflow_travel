import type {
  AgentRuntimeResult,
  AgentSession,
  AgentSessionRequest,
  AgentSessionState,
} from "./agent-runtime-types.js";
import type { AgentRuntimeService } from "./agent-runtime-service.js";

export class RuntimeAgentSession implements AgentSession {
  constructor(
    private readonly runtimeService: AgentRuntimeService,
    private readonly sessionId: string,
  ) {}

  execute(request: AgentSessionRequest): Promise<AgentRuntimeResult> {
    return this.runtimeService.execute(this.sessionId, request);
  }

  read(): Promise<AgentSessionState> {
    return this.runtimeService.readSession(this.sessionId);
  }
}
