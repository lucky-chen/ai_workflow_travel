import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MessageTurn } from "../runtime/agent-runtime-types.js";
import { resolveSessionTranscriptPath } from "../runtime/runtime-storage-paths.js";

export class SessionTranscriptStore {
  constructor(private readonly workdir: string) {}

  async initialize(sessionId: string, transcript: MessageTurn[]): Promise<void> {
    await this.writeTranscript(sessionId, transcript);
  }

  async load(sessionId: string): Promise<MessageTurn[]> {
    const transcriptPath = this.resolvePath(sessionId);
    let raw: string;

    try {
      raw = await readFile(transcriptPath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const parsed = JSON.parse(raw) as MessageTurn[];
    return parsed.map((turn) => ({ ...turn }));
  }

  async append(sessionId: string, turns: MessageTurn[]): Promise<void> {
    const transcript = await this.load(sessionId);
    transcript.push(...turns.map((turn) => ({ ...turn })));
    await this.writeTranscript(sessionId, transcript);
  }

  resolvePath(sessionId: string): string {
    return resolveSessionTranscriptPath(this.workdir, sessionId);
  }

  private async writeTranscript(sessionId: string, transcript: MessageTurn[]): Promise<void> {
    const transcriptPath = this.resolvePath(sessionId);
    await mkdir(path.dirname(transcriptPath), { recursive: true });
    await writeFile(transcriptPath, `${JSON.stringify(transcript, null, 2)}\n`, "utf8");
  }
}
