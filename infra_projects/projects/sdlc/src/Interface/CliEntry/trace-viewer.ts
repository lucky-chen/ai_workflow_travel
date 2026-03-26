import type { TraceEvent } from "../../SDK/QualityControl/Trace/trace-recorder.js";
import type { TraceViewer } from "./cli-types.js";

export class ConsoleTraceViewer implements TraceViewer {
  renderStatus(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  renderTrace(event: TraceEvent): void {
    process.stdout.write(`${event.eventType}: ${event.summary}\n`);
  }

  renderResult(summary: string): void {
    process.stdout.write(`${summary}\n`);
  }
}
