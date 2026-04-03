import type { AgentEvent, AgentRunInput, AgentRunResult, IAgent } from "../../interface/agent-api.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest, ModuleResponse } from "../../model/types.js";
import { BaseAgent } from "../base_agent.js";

class ChatPromptBuilder {
  constructor(private readonly sysPrompt: string[]) {}

  buildPrompt(input: AgentRunInput): Promise<ModuleRequest> {
    return Promise.resolve({
      systemPrompt: this.sysPrompt,
      responseFormat: "text",
      userPrompt: {
        stage: "chat",
        question: input.userInput,
        responseContract: {
          finalAnswer: "required string",
        },
      },
      stream: false,
    });
  }
}

class ChatResultChecker {
  check(result: ModuleResponse): Promise<{ data: string | Record<string, unknown>; format: "text" | "json" }> {
    if (result.error.code) {
      throw new Error(result.error.message || result.error.code);
    }
    if (!result.content) {
      throw new Error("Chat model returned empty content.");
    }
    try {
      return Promise.resolve({
        data: JSON.parse(result.content) as Record<string, unknown>,
        format: "json",
      });
    } catch {
      return Promise.resolve({
        data: result.content,
        format: "text",
      });
    }
  }
}

class ChatAgent extends BaseAgent {
  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly promptBuilder: ChatPromptBuilder,
    private readonly resultChecker: ChatResultChecker,
  ) {
    super("chat");
  }

  protected async execute(input: AgentRunInput, runId: string): Promise<AgentRunResult> {
    try {
      const prompt = await this.promptBuilder.buildPrompt(input);
      await this.publish(createAgentInputEvent(runId, prompt.userPrompt));
      const response = await this.executeModel(input, runId, prompt);
      const checked = await this.resultChecker.check(response);
      return createChatSuccessResult("chat", input, runId, checked);
    } catch (error) {
      return createChatFailureResult("chat", input, runId, error);
    }
  }

  private async executeModel(
    input: AgentRunInput,
    runId: string,
    request: ModuleRequest,
  ): Promise<ModuleResponse> {
    const model = await this.modelFactory.createDefaultModel();
    return model.execute(request);
  }
}

export function createChatAgent(input: {
  modelFactory: ModelFactory;
  sysPrompt: string[];
}): IAgent {
  return new ChatAgent(
    input.modelFactory,
    new ChatPromptBuilder(input.sysPrompt),
    new ChatResultChecker(),
  );
}

function createAgentInputEvent(runId: string, input: Record<string, unknown>): AgentEvent {
  return {
    timestamp: new Date().toISOString(),
    brief: "chat.respond.input",
    details: {
      runId,
      agent: "chat",
      step: "chat",
      input,
    },
  };
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
