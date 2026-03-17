// LLM executor module: public entry for shared LLM execution.
import type { ITraceRecorder } from "../../../SDK/QualityControl/Trace/trace-recorder.js";
import { TRACE_EVENT_TYPES } from "../../../SDK/QualityControl/Trace/trace-recorder.js";
import type { StringMap } from "../../../Runtime/Schema/runtime.js";
import {
  type IAgent,
} from "ai-meta-agent-agent-runtime";
import { createLlmExecutorAgent } from "./llm-executor-factory.js";
import { AgentTraceRecorderAdapter } from "./agent-trace-recorder-adapter.js";
import type { LlmExecutorServiceDependencies } from "./llm-executor-factory.js";

export type { LlmExecutorMode, LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
export type { RealLlmProvider, RealProviderConfig } from "ai-meta-agent-agent-runtime";

export type PromptContent = string | string[];
export type UserPromptInput = Readonly<Record<string, unknown>>;

export interface PromptInput {
  systemPrompt: PromptContent;
  userPrompt: UserPromptInput;
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

export function normalizePromptContent(content: PromptContent): string {
  return Array.isArray(content) ? content.join("\n\n") : content;
}

export function normalizeUserPromptContent(content: UserPromptInput): string {
  return JSON.stringify(content, null, 2);
}

// Public API: shared LLM execution entry used by generation and contract modules.
export class LlmExecutorService implements ILlmExecutor {
  private readonly agent: IAgent;
  private readonly traceRecorder?: ITraceRecorder;
  private readonly mode: "mock" | "real";
  private readonly provider?: string;

  constructor(dependencies: LlmExecutorServiceDependencies & { traceRecorder?: ITraceRecorder } = {}) {
    this.traceRecorder = dependencies.traceRecorder;
    this.mode = dependencies.mode ?? "mock";
    this.provider = dependencies.realProvider?.provider;
    const agentTraceRecorder = this.traceRecorder
      ? new AgentTraceRecorderAdapter(this.traceRecorder)
      : undefined;
    this.agent = createLlmExecutorAgent(dependencies, agentTraceRecorder);
  }

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    await this.traceRecorder?.recordTrace({
      caller: "LlmExecutorService.execute",
      executionUnitId: typeof request.metadata?.executionUnitId === "string"
        ? request.metadata.executionUnitId
        : typeof request.metadata?.executionUnit === "string"
          ? request.metadata.executionUnit
          : typeof request.metadata?.stage === "string"
            ? request.metadata.stage
          : undefined,
      eventType: TRACE_EVENT_TYPES.llmExecutionStarted,
      summary: "LLM execution started.",
      metadata: {
        mode: this.mode,
        ...(this.provider ? { provider: this.provider } : {}),
        responseFormat: request.responseFormat,
      },
    });

    const normalizedRequest = {
      ...request,
      prompt: {
        systemPrompt: normalizePromptContent(request.prompt.systemPrompt),
        userPrompt: normalizeUserPromptContent(request.prompt.userPrompt),
      },
    };

    const result = await this.agent.run({
      request: normalizedRequest,
      inputPayload: {
        responseFormat: normalizedRequest.responseFormat,
        metadata: normalizedRequest.metadata ?? {},
      },
    });

    await this.traceRecorder?.recordTrace({
      caller: "LlmExecutorService.execute",
      executionUnitId: typeof request.metadata?.executionUnitId === "string"
        ? request.metadata.executionUnitId
        : typeof request.metadata?.executionUnit === "string"
          ? request.metadata.executionUnit
          : typeof request.metadata?.stage === "string"
            ? request.metadata.stage
          : undefined,
      eventType: TRACE_EVENT_TYPES.llmExecutionFinished,
      summary: "LLM execution finished.",
      metadata: {
        mode: this.mode,
        ...(this.provider ? { provider: this.provider } : {}),
        responseFormat: result.result.responseFormat,
      },
    });

    return result.result;
  }
}
