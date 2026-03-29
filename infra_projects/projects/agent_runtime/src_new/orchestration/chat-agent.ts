import { randomUUID } from "node:crypto";

import type { AgentContext } from "../context/types.js";
import type { ModelFactory, ModuleResponse } from "../model/types.js";
import type { Trace } from "../observability/trace.js";
import type { AgentRuntimeResult, IAgent } from "./types.js";
import {
  createAssistantTranscriptTurn as createAssistantTurn,
  createUserTranscriptTurn as createUserTurn,
  getRuntimeContext,
} from "./agent-orchestration-helpers.js";

export class ChatPromptBuilder {
  async buildPrompt(context: AgentContext): Promise<Record<string, unknown>> {
    const activeContext = context.boundedContext ?? context.originalContext;
    return {
      sessionId: getRuntimeContext(context).sessionId,
      requestedMode: getRuntimeContext(context).requestedMode,
      transcript: activeContext.transcriptContext.turns,
      memory: activeContext.runtimeMemoryContext.summaryItems,
      retrieval: activeContext.retrievalContext?.fragments ?? [],
      userInput: getRuntimeContext(context).userInput.content,
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
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async run(context: AgentContext): Promise<AgentRuntimeResult> {
    const runId = randomUUID();
    this.running = true;
    try {
      await this.recordAgentStepStarted(context, runId);
      const prompt = await this.promptBuilder.buildPrompt(context);
      const response = await this.executeModel(context, runId, prompt);
      const checked = await this.resultChecker.check(response);
      return createChatSuccessResult(this.pattern, context, runId, checked);
    } catch (error) {
      return createChatFailureResult(this.pattern, context, runId, error);
    } finally {
      this.running = false;
    }
  }

  private async recordAgentStepStarted(context: AgentContext, runId: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "agent_step_started",
      timestamp: new Date().toISOString(),
      caller: "ChatAgent",
      summary: "chat run started",
      sessionId: getRuntimeContext(context).sessionId,
      runId,
    });
  }

  private async executeModel(
    context: AgentContext,
    runId: string,
    prompt: Record<string, unknown>,
  ): Promise<ModuleResponse> {
    const runtimeContext = getRuntimeContext(context);
    const model = this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "model_called",
      timestamp: new Date().toISOString(),
      caller: "ChatAgent",
      summary: "chat model called",
      sessionId: runtimeContext.sessionId,
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
      sessionId: runtimeContext.sessionId,
      runId,
    });
    return response;
  }
}

function createChatSuccessResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  checked: { data: string | Record<string, unknown>; format: "text" | "json" },
): AgentRuntimeResult {
  return {
    runId,
    traceId: runId,
    content: checked,
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend: [
        createUserTranscriptTurn(context),
        createAssistantTurn(checked.data),
      ],
      runtimeMemorySummaryItems: [
        { summary: summarizeUserInput(getRuntimeContext(context).userInput.content) },
      ],
    },
    executionFacts: {
      toolCalls: 0,
      failedToolCalls: 0,
    },
  };
}

function createChatFailureResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  error: unknown,
): AgentRuntimeResult {
  return {
    runId,
    traceId: runId,
    errorInfo: {
      code: "CHAT_AGENT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend: [createUserTranscriptTurn(context)],
      runtimeMemorySummaryItems: [],
    },
    executionFacts: {
      toolCalls: 0,
      failedToolCalls: 0,
    },
  };
}

function createAgentMetadata(pattern: IAgent["pattern"], context: AgentContext): AgentRuntimeResult["agent"] {
  return {
    prompt: {
      system: [],
      user: getRuntimeContext(context).userInput.content,
    },
    pattern,
  };
}

function createUserTranscriptTurn(context: AgentContext): AgentRuntimeResult["stateUpdate"]["transcriptAppend"][number] {
  return createUserTurn(context);
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
