import { randomUUID } from "node:crypto";

import type { AgentRunInput, AgentRunResult, IAgent } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest, ModuleResponse } from "../../model/types.js";
import type { RuntimeEventBus } from "../../capability/runtime-event-bus.js";

class ChatPromptBuilder {
  constructor(private readonly sysPrompt: string[]) {}

  async buildPrompt(input: AgentRunInput): Promise<ModuleRequest> {
    return {
      systemPrompt: this.sysPrompt,
      responseFormat: "text",
      userPrompt: {
        stage: "chat",
        question: input.userInput,
        expectedSchema: {
          finalAnswer: "required string",
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
  private running = false;

  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly promptBuilder: ChatPromptBuilder,
    private readonly resultChecker: ChatResultChecker,
    private readonly eventBus: RuntimeEventBus,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  subscribeEvents(): void {}

  unsubscribeEvents(): void {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const runId = randomUUID();
    this.running = true;
    try {
      const prompt = await this.promptBuilder.buildPrompt(input);
      await this.eventBus.publish({
        type: "agent",
        agentMessage: {
          event: "step",
          traceId: runId,
          timestamp: new Date().toISOString(),
          agent: {
            name: "chat",
            content: {
              step: "chat",
              input: prompt.userPrompt,
            },
          },
        },
      });
      const response = await this.executeModel(input, runId, prompt);
      const checked = await this.resultChecker.check(response);
      return createChatSuccessResult("chat", input, runId, checked);
    } catch (error) {
      return createChatFailureResult("chat", input, runId, error);
    } finally {
      this.running = false;
    }
  }

  private async executeModel(
    input: AgentRunInput,
    runId: string,
    request: ModuleRequest,
  ): Promise<ModuleResponse> {
    const model = await this.modelFactory.createDefaultModel();
    try {
      return await model.execute(request);
    } catch (error) {
      throw error;
    }
  }
}

export function createChatAgent(input: {
  modelFactory: ModelFactory;
  eventBus: RuntimeEventBus;
  sysPrompt: string[];
}): IAgent {
  return new ChatAgent(
    input.modelFactory,
    new ChatPromptBuilder(input.sysPrompt),
    new ChatResultChecker(),
    input.eventBus,
  );
}

function createChatSuccessResult(
  _pattern: "chat",
  _input: AgentRunInput,
  runId: string,
  checked: { data: string | Record<string, unknown>; format: "text" | "json" },
): AgentRunResult {
  return {
    content: checked.data,
    format: checked.format,
  };
}

function createChatFailureResult(
  _pattern: "chat",
  _input: AgentRunInput,
  runId: string,
  error: unknown,
): AgentRunResult {
  return {
    format: "text",
    errorInfo: {
      code: "CHAT_AGENT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}
