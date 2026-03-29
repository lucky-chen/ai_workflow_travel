import { randomUUID } from "node:crypto";

import type { McpGateway, ToolCallResult } from "../capability/types.js";
import type { AgentContext } from "../context/types.js";
import type { ModelFactory, ModuleResponse } from "../model/types.js";
import type { Trace } from "../observability/trace.js";
import type { AgentRuntimeResult, IAgent } from "./types.js";
import {
  asNumber,
  contentIncludesToolHint,
  createAssistantTranscriptTurn,
  createBaseTranscript,
  createToolTranscriptTurn,
  ensureSuccessfulModelResponse,
  getRequestedToolName,
  getRuntimeContext,
  isRecord,
  tryParseJsonRecord,
} from "./agent-orchestration-helpers.js";

const REACT_MAX_STEPS = 2;

export class ThoughtPromptBuilder {
  async buildPrompt(context: AgentContext, priorObservation?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const activeContext = context.boundedContext ?? context.originalContext;
    const runtimeContext = getRuntimeContext(context);
    return {
      iterationLimit: REACT_MAX_STEPS,
      stepIndex: 1,
      transcript: activeContext.transcriptContext.turns,
      userInput: runtimeContext.userInput.content,
      availableToolName: typeof runtimeContext.userInput.content.toolName === "string"
        ? runtimeContext.userInput.content.toolName
        : undefined,
      priorObservation,
    };
  }
}

export class ThoughtChecker {
  async check(thought: Record<string, unknown>): Promise<Record<string, unknown>> {
    const content = typeof thought.content === "string" ? thought.content : "";
    if (!content.trim()) {
      throw new Error("ReAct thought is empty.");
    }
    const parsed = tryParseJsonRecord(content);
    const normalizedThought = typeof parsed?.thought === "string" && parsed.thought.trim()
      ? parsed.thought
      : content;
    const toolName = typeof parsed?.toolName === "string"
      ? parsed.toolName
      : typeof thought.availableToolName === "string" && contentIncludesToolHint(content, thought.availableToolName)
        ? thought.availableToolName
        : undefined;
    const actionType = normalizeActionType(parsed?.actionType, toolName);
    return {
      thought: normalizedThought,
      actionType,
      toolName,
      actionPayload: isRecord(parsed?.actionPayload) ? parsed?.actionPayload : undefined,
      shouldContinue: parsed?.shouldContinue === true || actionType === "tool",
      finalAnswer: typeof parsed?.finalAnswer === "string" ? parsed.finalAnswer : undefined,
    };
  }
}

export class TaskExecutor {
  constructor(private readonly gateway: McpGateway) {}

  async execute(task: Record<string, unknown>, context: AgentContext): Promise<Record<string, unknown>> {
    if (task.actionType !== "tool" || typeof task.toolName !== "string") {
      return {
        toolCalls: 0,
        failedToolCalls: 0,
        observation: typeof task.thought === "string" ? task.thought : "",
      };
    }

    const runtimeContext = getRuntimeContext(context);
    const result = await this.gateway.call({
      toolName: task.toolName,
      payload: isRecord(task.actionPayload)
        ? task.actionPayload
        : isRecord(runtimeContext.userInput.content.toolPayload)
          ? runtimeContext.userInput.content.toolPayload
          : {},
      sessionId: runtimeContext.sessionId,
      runId: String(task.runId ?? ""),
      stepIndex: 1,
      workingDirectory: typeof runtimeContext.userInput.content.workingDirectory === "string"
        ? runtimeContext.userInput.content.workingDirectory
        : undefined,
      allowedWorkingDirectories: runtimeContext.allowedWorkingDirectories,
    });
    return normalizeTaskExecutionResult(result);
  }
}

export class ActionResultChecker {
  async check(actionResult: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof actionResult.observation !== "string") {
      throw new Error("ReAct action result is invalid.");
    }
    return actionResult;
  }
}

export class ObservationChecker {
  async check(observation: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof observation.observation !== "string") {
      throw new Error("ReAct observation is invalid.");
    }
    return {
      observation: observation.observation,
      shouldContinue: observation.shouldContinue === true,
      finalAnswer: typeof observation.finalAnswer === "string" ? observation.finalAnswer : undefined,
    };
  }
}

export class ReActAgent implements IAgent {
  readonly pattern = "react" as const;
  private running = false;

  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly thoughtPromptBuilder: ThoughtPromptBuilder,
    private readonly thoughtChecker: ThoughtChecker,
    private readonly taskExecutor: TaskExecutor,
    private readonly actionResultChecker: ActionResultChecker,
    private readonly observationChecker: ObservationChecker,
    private readonly trace: Trace,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async run(context: AgentContext): Promise<AgentRuntimeResult> {
    const runId = randomUUID();
    this.running = true;
    let toolCalls = 0;
    let failedToolCalls = 0;
    try {
      const transcriptAppend = createBaseTranscript(context);
      const thoughtPrompt = await this.thoughtPromptBuilder.buildPrompt(context);
      const thoughtResponse = await this.executeThoughtModel(context, runId, thoughtPrompt);
      const checkedThought = await this.thoughtChecker.check({
        content: thoughtResponse.content,
        runId,
        availableToolName: getRequestedToolName(context),
      });
      const actionResult = await this.executeAction(context, runId, checkedThought);
      toolCalls += asNumber(actionResult.toolCalls);
      failedToolCalls += asNumber(actionResult.failedToolCalls);
      const checkedAction = await this.actionResultChecker.check({
        ...actionResult,
        shouldContinue: checkedThought.shouldContinue,
        finalAnswer: checkedThought.finalAnswer,
      });
      const checkedObservation = await this.observationChecker.check(checkedAction);
      if (checkedThought.actionType === "tool" && typeof checkedObservation.observation === "string" && checkedObservation.observation) {
        transcriptAppend.push(createToolTranscriptTurn(checkedObservation.observation));
      }
      const finalContent = resolveReactFinalContent(checkedThought, checkedObservation);
      transcriptAppend.push(createAssistantTranscriptTurn(finalContent));
      return createReactSuccessResult(
        this.pattern,
        context,
        runId,
        finalContent,
        transcriptAppend,
        toolCalls,
        failedToolCalls,
      );
    } catch (error) {
      return createReactFailureResult(this.pattern, context, runId, error, toolCalls, failedToolCalls);
    } finally {
      this.running = false;
    }
  }

  private async executeThoughtModel(
    context: AgentContext,
    runId: string,
    prompt: Record<string, unknown>,
  ): Promise<ModuleResponse> {
    const model = this.createModel(context);
    await this.recordModelCalled(context, runId, "react model called");
    const response = await model.execute({ prompt, stream: false });
    await this.recordModelResult(context, runId, "react thought recorded");
    ensureSuccessfulModelResponse(response);
    return response;
  }

  private async executeAction(
    context: AgentContext,
    runId: string,
    thought: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const toolName = typeof thought.toolName === "string" ? thought.toolName : undefined;
    if (toolName) {
      await this.recordToolCalled(context, runId, toolName);
    }
    const actionResult = await this.taskExecutor.execute({
      ...thought,
      runId,
    }, context);
    if (toolName) {
      await this.recordToolResult(context, runId, toolName);
    }
    return actionResult;
  }

  private createModel(context: AgentContext) {
    const runtimeContext = getRuntimeContext(context);
    return this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
  }

  private async recordToolCalled(context: AgentContext, runId: string, toolName: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "tool_called",
      timestamp: new Date().toISOString(),
      caller: "ReActAgent",
      summary: `tool called: ${toolName}`,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
      stepIndex: 1,
    });
  }

  private async recordToolResult(context: AgentContext, runId: string, toolName: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "tool_result_recorded",
      timestamp: new Date().toISOString(),
      caller: "ReActAgent",
      summary: `tool result recorded: ${toolName}`,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
      stepIndex: 1,
    });
  }

  private async recordModelCalled(context: AgentContext, runId: string, summary: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "model_called",
      timestamp: new Date().toISOString(),
      caller: "ReActAgent",
      summary,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
    });
  }

  private async recordModelResult(context: AgentContext, runId: string, summary: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "model_result_recorded",
      timestamp: new Date().toISOString(),
      caller: "ReActAgent",
      summary,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
    });
  }
}

function createReactSuccessResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  content: string,
  transcriptAppend: AgentRuntimeResult["stateUpdate"]["transcriptAppend"],
  toolCalls: number,
  failedToolCalls: number,
): AgentRuntimeResult {
  return {
    runId,
    traceId: runId,
    content: {
      data: content,
      format: "text",
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend,
      runtimeMemorySummaryItems: [
        { summary: `react:${getRequestedToolName(context) ?? "no-tool"}` },
      ],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
    },
  };
}

function createReactFailureResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  error: unknown,
  toolCalls: number,
  failedToolCalls: number,
): AgentRuntimeResult {
  return {
    runId,
    traceId: runId,
    errorInfo: {
      code: "REACT_AGENT_FAILED",
      message: error instanceof Error ? error.message : String(error),
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend: createBaseTranscript(context),
      runtimeMemorySummaryItems: [],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
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

function normalizeTaskExecutionResult(result: ToolCallResult): Record<string, unknown> {
  return {
    toolCalls: 1,
    failedToolCalls: result.error ? 1 : 0,
    observation: result.error ? result.error.message : result.content,
  };
}

function normalizeActionType(candidate: unknown, toolName: string | undefined): "tool" | "respond" {
  if (candidate === "tool" || candidate === "respond") {
    return candidate;
  }
  return toolName ? "tool" : "respond";
}

function resolveReactFinalContent(
  checkedThought: Record<string, unknown>,
  checkedObservation: Record<string, unknown>,
): string {
  if (typeof checkedObservation.finalAnswer === "string" && checkedObservation.finalAnswer) {
    return checkedObservation.finalAnswer;
  }
  if (typeof checkedObservation.observation === "string" && checkedObservation.observation) {
    return checkedObservation.observation;
  }
  if (typeof checkedThought.thought === "string" && checkedThought.thought) {
    return checkedThought.thought;
  }
  throw new Error("ReAct final content is empty.");
}
