import { randomUUID } from "node:crypto";

import type { McpGateway } from "../capability/types.js";
import type { ModelFactory, ModuleResponse } from "../model/types.js";
import type { Trace } from "../observability/trace.js";
import type { AgentRunContext, AgentRuntimeResult, IAgent } from "./types.js";

export class ChatPromptBuilder {
  async buildPrompt(context: AgentRunContext): Promise<Record<string, unknown>> {
    const activeContext = context.context.boundedContext ?? context.context.originalContext;
    return {
      sessionId: context.sessionId,
      requestedMode: context.requestedMode,
      transcript: activeContext.transcriptContext.turns,
      memory: activeContext.runtimeMemoryContext.summaryItems,
      retrieval: activeContext.retrievalContext?.fragments ?? [],
      userInput: context.userInput.content,
    };
  }
}

export class ChatResultChecker {
  async check(result: ModuleResponse): Promise<{ data: string | Record<string, unknown>; format: "text" | "json" }> {
    if (result.error.code) {
      throw new Error(result.error.message || result.error.code);
    }
    if (!result.content) {
      throw new Error("Chat model returned empty content.");
    }

    try {
      return {
        data: JSON.parse(result.content) as Record<string, unknown>,
        format: "json",
      };
    } catch {
      return {
        data: result.content,
        format: "text",
      };
    }
  }
}

export class ChatAgent implements IAgent {
  readonly pattern = "chat" as const;
  private running = false;

  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly promptBuilder: ChatPromptBuilder,
    private readonly resultChecker: ChatResultChecker,
    private readonly trace: Trace,
    private readonly _gateway: McpGateway,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async run(context: AgentRunContext): Promise<AgentRuntimeResult> {
    const runId = randomUUID();
    this.running = true;
    try {
      await this.trace.record({
        traceId: runId,
        scope: "session",
        eventType: "agent_step_started",
        timestamp: new Date().toISOString(),
        caller: "ChatAgent",
        summary: "chat run started",
        sessionId: context.sessionId,
        runId,
      });

      const prompt = await this.promptBuilder.buildPrompt(context);
      const model = this.modelFactory.createModel({
        mock: context.modelConfig?.mock ?? true,
        modeSelection: context.modelConfig?.modeSelection ?? {},
        mockInfo: context.modelConfig?.mockInfo,
      });
      await this.trace.record({
        traceId: runId,
        scope: "session",
        eventType: "model_called",
        timestamp: new Date().toISOString(),
        caller: "ChatAgent",
        summary: "chat model called",
        sessionId: context.sessionId,
        runId,
      });
      const response = await model.execute({
        prompt,
        stream: false,
      });
      await this.trace.record({
        traceId: runId,
        scope: "session",
        eventType: "model_result_recorded",
        timestamp: new Date().toISOString(),
        caller: "ChatAgent",
        summary: "chat model result recorded",
        sessionId: context.sessionId,
        runId,
      });

      const checked = await this.resultChecker.check(response);
      return {
        runId,
        traceId: runId,
        content: checked,
        agent: {
          prompt: {
            system: [],
            user: context.userInput.content,
          },
          pattern: this.pattern,
        },
        stateUpdate: {
          transcriptAppend: [
            { role: "user", content: stringifyContent(context.userInput.content), timestamp: new Date().toISOString() },
            { role: "assistant", content: stringifyContent(checked.data), timestamp: new Date().toISOString() },
          ],
          runtimeMemorySummaryItems: [
            { summary: summarizeUserInput(context.userInput.content) },
          ],
        },
        executionFacts: {
          toolCalls: 0,
          failedToolCalls: 0,
        },
      };
    } catch (error) {
      return {
        runId,
        traceId: runId,
        errorInfo: {
          code: "CHAT_AGENT_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
        agent: {
          prompt: {
            system: [],
            user: context.userInput.content,
          },
          pattern: this.pattern,
        },
        stateUpdate: {
          transcriptAppend: [
            { role: "user", content: stringifyContent(context.userInput.content), timestamp: new Date().toISOString() },
          ],
          runtimeMemorySummaryItems: [],
        },
        executionFacts: {
          toolCalls: 0,
          failedToolCalls: 0,
        },
      };
    } finally {
      this.running = false;
    }
  }
}

function summarizeUserInput(content: Record<string, unknown>): string {
  if (typeof content.task === "string") {
    return content.task;
  }
  if (typeof content.queryText === "string") {
    return content.queryText;
  }
  return JSON.stringify(content);
}

function stringifyContent(content: string | Record<string, unknown>): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}
