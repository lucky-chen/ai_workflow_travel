import type { MessageTurn } from "../runtime/agent-runtime-types.js";

export class SessionHistoryStore {
  private readonly histories = new Map<string, MessageTurn[]>();

  async initialize(sessionId: string, transcript: MessageTurn[]): Promise<void> {
    this.histories.set(sessionId, transcript.map((turn) => ({ ...turn })));
  }

  async load(sessionId: string): Promise<MessageTurn[]> {
    return (this.histories.get(sessionId) ?? []).map((turn) => ({ ...turn }));
  }

  async append(sessionId: string, turns: MessageTurn[]): Promise<void> {
    const history = this.histories.get(sessionId) ?? [];
    history.push(...turns.map((turn) => ({ ...turn })));
    this.histories.set(sessionId, history);
  }
}
