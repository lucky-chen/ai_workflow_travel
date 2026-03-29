import { randomUUID } from "node:crypto";

import type { AgentContext } from "../../context/types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest, ModuleResponse } from "../../model/types.js";
import type { Trace } from "../../observability/trace.js";
import type { AgentRuntimeResult, IAgent } from "../types.js";
import {
  createContextBasis,
  createAssistantTranscriptTurn as createAssistantTurn,
  createUserTranscriptTurn as createUserTurn,
  getRuntimeContext,
  summarizeModuleRequest,
  summarizeModuleResponse,
} from "../agent_orchestration_helpers.js";

class ChatPromptBuilder {
  async buildPrompt(context: AgentContext): Promise<ModuleRequest> {
    const runtimeContext = getRuntimeContext(context);
    return {
      systemPrompt: [],
      responseFormat: "text",
      userPrompt: {
        stage: "chat",
        question: runtimeContext.userInput.content,
        contextBasis: createContextBasis({ context }),
        expectedSchema: {
          finalAnswer: "required string",
        },
        runtimeState: {
          requestedMode: runtimeContext.requestedMode,
        },
      },
      stream: false,
    };
  }
}

class ChatResultChecker {
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

class ChatAgent implements IAgent {
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

  private async executeModel(
    context: AgentContext,
    runId: string,
    request: ModuleRequest,
  ): Promise<ModuleResponse> {
    const runtimeContext = getRuntimeContext(context);
    const model = this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
    await this.trace.record({
      scope: "session",
      eventType: "model_called",
      sessionId: runtimeContext.sessionId,
      payload: {
        stage: "chat",
      },
      metadata: {
        traceId: runId,
        timestamp: new Date().toISOString(),
      },
    });
    try {
      return await model.execute(request);
    } catch (error) {
      const response = error && typeof error === "object" && "content" in error && "error" in error
        ? error as { content: string; error: { code: string; message: string } }
        : undefined;
      await this.trace.record({
        scope: "session",
        eventType: "model_result_recorded",
        sessionId: runtimeContext.sessionId,
        payload: {
          stage: "chat",
          requestSummary: summarizeModuleRequest(request),
          responseSummary: response ? summarizeModuleResponse(response) : undefined,
          error: {
            code: response?.error.code ?? "MODEL_CALL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
        },
        metadata: {
          traceId: runId,
          timestamp: new Date().toISOString(),
        },
      });
      throw error;
    }
  }
}

export function createChatAgent(input: {
  modelFactory: ModelFactory;
  trace: Trace;
}): IAgent {
  return new ChatAgent(
    input.modelFactory,
    new ChatPromptBuilder(),
    new ChatResultChecker(),
    input.trace,
  );
}

function createChatSuccessResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  checked: { data: string | Record<string, unknown>; format: "text" | "json" },
): AgentRuntimeResult {
  return {
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
