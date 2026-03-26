import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentTraceEvent, IAgentTraceRecorder } from "./agent-runtime-types.js";

export class FileAgentTraceRecorder implements IAgentTraceRecorder {
  constructor(private readonly outputPath: string) {}

  async record(event: AgentTraceEvent): Promise<void> {
    await mkdir(path.dirname(this.outputPath), { recursive: true });
    const existingEvents = await this.readEvents();
    existingEvents.push(event);
    await writeFile(this.outputPath, `${JSON.stringify(existingEvents, null, 2)}\n`, "utf8");
  }

  private async readEvents(): Promise<AgentTraceEvent[]> {
    try {
      const raw = await readFile(this.outputPath, "utf8");
      const parsed = JSON.parse(raw) as AgentTraceEvent[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}
