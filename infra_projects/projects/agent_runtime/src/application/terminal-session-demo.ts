import type {
  ChatHistoryItem,
  CloseSessionResult,
  SessionApi,
  SessionResult,
  UserInput,
  RuntimeCreateOptions,
} from "../interface/api.js";
import { createRuntime } from "../interface/api.js";
import type { RuntimeEvent } from "../capability/runtime-event.js";

export interface TerminalSessionDemoEntry {
  run(input: TerminalSessionDemoOptions): Promise<TerminalSessionDemoResult>;
}

export interface TerminalSessionDemoOptions {
  sessionId?: string;
  sysPrompt?: string[];
  userPrompt?: Record<string, unknown>;
  config?: Record<string, unknown>;
  readInput?: () => Promise<{ rawText: string; closeRequested: boolean }>;
  writeLine?: (line: string) => Promise<void> | void;
  runtime?: SessionApi;
  workdir?: RuntimeCreateOptions["workdir"];
}

export interface TerminalSessionDemoResult {
  sessionId: string;
  closeResult: CloseSessionResult;
}

export interface RuntimeEventDisplay {
  title: string;
  detail?: string;
}

export class TerminalInputHandler {
  constructor(private readonly readInputImpl: () => Promise<{ rawText: string; closeRequested: boolean }>) {}

  async parseStartupInput(argv: string[]): Promise<{ mode: "create" | "open"; sessionId?: string }> {
    const sessionId = parseSessionIdArg(argv);
    return sessionId
      ? { mode: "open", sessionId }
      : { mode: "create" };
  }

  async readUserInput(): Promise<{ rawText: string; closeRequested: boolean }> {
    return this.readInputImpl();
  }

  toUserInput(userInput: { rawText: string; closeRequested: boolean }): UserInput {
    return {
      content: {
        task: userInput.rawText,
      },
    };
  }
}

export class TerminalOutputRenderer {
  constructor(private readonly writeLine: (line: string) => Promise<void> | void) {}

  renderHistory(history: ChatHistoryItem[]): Promise<void> {
    return history.reduce<Promise<void>>(
      async (previous, item) => {
        await previous;
        await this.writeLine(formatHistoryItem(item));
      },
      Promise.resolve(),
    );
  }

  renderAgentOutput(output: SessionResult): void | Promise<void> {
    if (typeof output.content === "string") {
      return this.writeLine(output.content);
    }
    if (output.content) {
      return this.writeLine(JSON.stringify(output.content));
    }
    return this.writeLine(output.errorMessage ?? "");
  }

  renderFailure(error: { summary: string; traceId?: string }): void | Promise<void> {
    const suffix = error.traceId ? ` [trace=${error.traceId}]` : "";
    return this.writeLine(`${error.summary}${suffix}`);
  }

  renderCloseResult(result: CloseSessionResult): void | Promise<void> {
    return this.writeLine(`Session closed: ${result.sessionId}`);
  }
}

export class TerminalSessionDemo implements TerminalSessionDemoEntry {
  constructor(
    private readonly runtime: SessionApi,
    private readonly inputHandler: TerminalInputHandler,
    private readonly outputRenderer: TerminalOutputRenderer,
  ) {}

  async run(input: TerminalSessionDemoOptions): Promise<TerminalSessionDemoResult> {
    const session = input.sessionId
      ? await this.runtime.openSession(input.sessionId)
      : await this.runtime.createSession({
          sysPrompt: input.sysPrompt,
          userPrompt: input.userPrompt,
          config: input.config,
        });

    if (input.sessionId) {
      const state = await session.load();
      await this.outputRenderer.renderHistory(state.history);
    }

    while (true) {
      const nextInput = await this.inputHandler.readUserInput();
      if (nextInput.closeRequested) {
        break;
      }

      try {
        const result = await session.execute(this.inputHandler.toUserInput(nextInput));
        await this.outputRenderer.renderAgentOutput(result);
      } catch (error) {
        await this.outputRenderer.renderFailure({
          summary: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const state = await session.load();
    const closeResult = await this.runtime.closeSession(state.sessionId);
    await this.outputRenderer.renderCloseResult(closeResult);
    return {
      sessionId: state.sessionId,
      closeResult,
    };
  }
}

export function createTerminalSessionDemo(input: TerminalSessionDemoOptions): TerminalSessionDemo {
  const runtime = input.runtime ?? createRuntime({
    workdir: input.workdir ?? process.cwd(),
    defaultModelMode: "real_from_local_env",
  });
  const inputHandler = new TerminalInputHandler(
    input.readInput ?? (async () => ({ rawText: "", closeRequested: true })),
  );
  const outputRenderer = new TerminalOutputRenderer(
    input.writeLine ?? (() => {}),
  );
  return new TerminalSessionDemo(runtime, inputHandler, outputRenderer);
}

export function toRuntimeEventDisplay(event: RuntimeEvent): RuntimeEventDisplay {
  switch (event.type) {
    case "runtime":
      return describeRuntimeEvent(event);
    case "agent":
      return describeAgentEvent(event);
    case "model":
      return describeModelEvent(event);
    case "tool":
      return describeToolEvent(event);
    default:
      return { title: "Unknown event" };
  }
}

function describeRuntimeEvent(event: Extract<RuntimeEvent, { type: "runtime" }>): RuntimeEventDisplay {
  switch (event.runtimeMessage.event) {
    case "session_created":
      return { title: "Session created" };
    case "session_opened":
      return { title: "Session opened" };
    case "run_finished":
      return { title: "Run finished" };
    case "run_failed":
      return { title: "Run failed" };
    default:
      return { title: event.runtimeMessage.event };
  }
}

function describeAgentEvent(event: Extract<RuntimeEvent, { type: "agent" }>): RuntimeEventDisplay {
  return { title: describeAgentStep(event) };
}

function describeModelEvent(event: Extract<RuntimeEvent, { type: "model" }>): RuntimeEventDisplay {
  return event.modelMessage.event === "model_started"
    ? { title: describeModelStarted(event) }
    : { title: describeModelCompleted(event) };
}

function describeToolEvent(event: Extract<RuntimeEvent, { type: "tool" }>): RuntimeEventDisplay {
  return {
    title: `${event.toolMessage.event === "tool_started" ? "Tool started" : "Tool failed"}: ${event.toolMessage.tool.toolName}`,
  };
}

function formatHistoryItem(item: ChatHistoryItem): string {
  return `[${item.role}] ${item.content}`;
}

function parseSessionIdArg(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--session-id" && argv[index + 1]) {
      return argv[index + 1];
    }
  }
  return undefined;
}

function describeModelStarted(event: Extract<RuntimeEvent, { type: "model" }>): string {
  return "Model started";
}

function describeModelCompleted(event: Extract<RuntimeEvent, { type: "model" }>): string {
  return "Model completed";
}

function describeAgentStep(event: Extract<RuntimeEvent, { type: "agent" }>): string {
  if (event.agentMessage.agent.name === "chat") {
    return "Chat";
  }
  if (event.agentMessage.agent.name === "react") {
    return `React ${event.agentMessage.agent.content.step}`;
  }
  if (event.agentMessage.agent.name === "peo") {
    return `PEO ${event.agentMessage.agent.content.step}`;
  }
  return "Agent step";
}
