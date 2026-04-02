import type { SessionApi } from "../src/interface/api.js";
import {
  createTerminalSessionDemo,
  type TerminalSessionDemoOptions,
} from "../src/application/terminal-session-demo.js";

export interface ExampleTerminalSessionDemoOptions {
  runtime?: SessionApi;
  workdir?: string;
  sessionId?: string;
  initialSystemPrompt?: string[];
  readInput: () => Promise<string | null>;
  writeOutput: (line: string) => Promise<void> | void;
}

export interface ExampleTerminalSessionDemoResult {
  sessionId: string;
  closed: boolean;
}

export async function runTerminalSessionDemo(
  options: ExampleTerminalSessionDemoOptions,
): Promise<ExampleTerminalSessionDemoResult> {
  const demo = createTerminalSessionDemo({
    runtime: options.runtime,
    workdir: options.workdir,
    sessionId: options.sessionId,
    sysPrompt: options.initialSystemPrompt,
    readInput: async () => {
      const rawText = await options.readInput();
      return {
        rawText: rawText ?? "",
        closeRequested: rawText === null || rawText.trim().toLowerCase() === "exit",
      };
    },
    writeLine: options.writeOutput,
  } satisfies TerminalSessionDemoOptions);

  const result = await demo.run({
    runtime: options.runtime,
    workdir: options.workdir,
    sessionId: options.sessionId,
    sysPrompt: options.initialSystemPrompt,
  });
  return {
    sessionId: result.sessionId,
    closed: true,
  };
}
