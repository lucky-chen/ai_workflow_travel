import type { MessageTurn } from "../runtime/agent-runtime-types.js";
import { resolveSessionTranscriptPath } from "../runtime/runtime-storage-paths.js";
import { BufferedFileStore } from "../shared/buffered-file-store.js";

export class SessionTranscriptStore extends BufferedFileStore<MessageTurn[]> {
  constructor(private readonly workdir: string, flushThreshold = 3) {
    super(flushThreshold);
  }

  async initialize(sessionId: string, transcript: MessageTurn[]): Promise<void> {
    await this.saveBuffered(sessionId, transcript);
    if (this.shouldFlushByThreshold()) {
      await this.flush(sessionId);
    }
  }

  async load(sessionId: string): Promise<MessageTurn[]> {
    return this.loadBuffered(sessionId);
  }

  async append(sessionId: string, turns: MessageTurn[]): Promise<void> {
    const transcript = await this.load(sessionId);
    transcript.push(...turns.map((turn) => ({ ...turn })));
    await this.saveBuffered(sessionId, transcript);
    if (this.shouldFlushByThreshold()) {
      await this.flush(sessionId);
    }
  }

  async flush(sessionId?: string): Promise<void> {
    await this.flushBuffered(sessionId);
  }

  resolvePath(sessionId: string): string {
    return resolveSessionTranscriptPath(this.workdir, sessionId);
  }

  protected emptyValue(): MessageTurn[] {
    return [];
  }

  protected parse(raw: string): MessageTurn[] {
    return (JSON.parse(raw) as MessageTurn[]).map((turn) => ({ ...turn }));
  }

  protected serialize(value: MessageTurn[]): string {
    return `${JSON.stringify(this.cloneValue(value), null, 2)}\n`;
  }

  protected cloneValue(value: MessageTurn[]): MessageTurn[] {
    return value.map((turn) => ({ ...turn }));
  }
}
