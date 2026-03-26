import type {
  AgentContext,
  AgentSessionRequest,
  AgentSessionState,
  RetrievalRequest,
} from "../runtime/agent-runtime-types.js";
import type { RetrievalProvider } from "./default-retrieval-provider.js";
import { RuntimeMemoryStore } from "./runtime-memory-store.js";
import { SessionHistoryStore } from "./session-history-store.js";

export class ContextAssembler {
  constructor(
    private readonly historyStore: SessionHistoryStore,
    private readonly memoryStore: RuntimeMemoryStore,
    private readonly retrievalProvider: RetrievalProvider,
    private readonly workdir: string,
  ) {}

  async assemble(session: AgentSessionState, request: AgentSessionRequest): Promise<AgentContext> {
    const history = await this.historyStore.load(session.sessionId);
    const memory = await this.memoryStore.load(request.payload.memoryScope);
    const retrievalContext = request.payload.retrievalQuery
      ? await this.retrievalProvider.load(this.buildRetrievalRequest(session, request))
      : [];

    return {
      request: {
        prompt: {
          systemPrompt: [...request.payload.prompt.systemPrompt],
          userPrompt: { ...request.payload.prompt.userPrompt },
        },
        responseFormat: request.payload.responseFormat,
        metadata: request.metadata ? { ...request.metadata, labels: request.metadata.labels ? { ...request.metadata.labels } : undefined } : undefined,
      },
      runtimeContext: {
        sessionId: session.sessionId,
        workdir: this.workdir,
        runId: undefined,
        history,
        memory,
        retrievalContext,
        mcpToolCalls: request.payload.mcpToolCalls?.map((toolCall) => ({
          toolName: toolCall.toolName,
          arguments: { ...toolCall.arguments },
        })) ?? [],
      },
    };
  }

  private buildRetrievalRequest(session: AgentSessionState, request: AgentSessionRequest): RetrievalRequest {
    return {
      query: request.payload.retrievalQuery ?? "",
      candidateSources: [
        `${this.workdir}/docs`,
        this.historyStore.resolvePath(session.sessionId),
      ],
      metadata: request.metadata,
    };
  }
}
