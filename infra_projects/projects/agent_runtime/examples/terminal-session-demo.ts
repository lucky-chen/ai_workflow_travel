import {
  createAgentRuntime,
  type AgentRuntime,
  type AgentSession,
} from "../src/runtime/agent-runtime.js";

export interface TerminalSessionDemoOptions {
  runtime?: AgentRuntime;
  workdir?: string;
  sessionId?: string;
  initialSystemPrompt?: string[];
  readInput: () => Promise<string | null>;
  writeOutput: (line: string) => Promise<void> | void;
}

export interface TerminalSessionDemoResult {
  sessionId: string;
  closed: boolean;
}

export async function runTerminalSessionDemo(
  options: TerminalSessionDemoOptions,
): Promise<TerminalSessionDemoResult> {
  const runtime = options.runtime ?? createAgentRuntime({
    workdir: options.workdir ?? process.cwd(),
  });
  const session = options.sessionId
    ? await runtime.openSession({ sessionId: options.sessionId })
    : await runtime.createSession({
        initialSystemPrompt: options.initialSystemPrompt,
      });

  await runInteractionLoop(session, options.readInput, options.writeOutput);

  const state = await session.read();
  const closeResult = await runtime.closeSession(state.sessionId);
  return {
    sessionId: state.sessionId,
    closed: closeResult.closed,
  };
}

async function runInteractionLoop(
  session: AgentSession,
  readInput: () => Promise<string | null>,
  writeOutput: (line: string) => Promise<void> | void,
): Promise<void> {
  while (true) {
    const input = await readInput();
    if (input === null || input.trim().toLowerCase() === "exit") {
      return;
    }

    const result = await session.execute({
      payload: {
        prompt: {
          systemPrompt: ["You are an agent runtime assistant."],
          userPrompt: {
            input,
          },
        },
        responseFormat: "json",
      },
    });

    await writeOutput(result.payload.content ?? result.payload.summary ?? "");
  }
}
