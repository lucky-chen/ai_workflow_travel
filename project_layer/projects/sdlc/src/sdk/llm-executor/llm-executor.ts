// LLM executor module: public entry for shared LLM execution.
import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
import type { StringMap } from "../../shared/types/common.js";
import { createLlmExecutor } from "./llm-executor-factory.js";
import type { LlmExecutorServiceDependencies } from "./llm-executor-factory.js";

export type { LlmExecutorMode, LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
export type { RealLlmProvider, RealProviderConfig } from "ai-meta-agent-agent-runtime";

export interface PromptInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface LlmExecutionRequest {
  prompt: PromptInput;
  responseFormat: "text" | "json";
  metadata?: StringMap;
}

export interface LlmExecutionResult {
  content: string;
  responseFormat: "text" | "json";
  metadata?: StringMap;
}

export interface ILlmExecutor {
  execute(request: LlmExecutionRequest): Promise<LlmExecutionResult>;
}

// Public API: shared LLM execution entry used by generation and contract modules.
export class LlmExecutorService implements ILlmExecutor {
  private readonly executor: ILlmExecutor;
  private readonly traceRecorder?: ITraceRecorder;

  constructor(dependencies: LlmExecutorServiceDependencies & { traceRecorder?: ITraceRecorder } = {}) {
    this.executor = createLlmExecutor(dependencies);
    this.traceRecorder = dependencies.traceRecorder;
  }

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    await this.traceRecorder?.recordTrace({
      taskId: "llm-executor",
      eventType: "llm_execution_started",
      summary: "LLM execution started.",
      metadata: {
        responseFormat: request.responseFormat,
      },
    });

    const result = await this.executor.execute(request);

    await this.traceRecorder?.recordTrace({
      taskId: "llm-executor",
      eventType: "llm_execution_finished",
      summary: "LLM execution finished.",
      metadata: {
        responseFormat: result.responseFormat,
      },
    });

    return result;
  }
}
