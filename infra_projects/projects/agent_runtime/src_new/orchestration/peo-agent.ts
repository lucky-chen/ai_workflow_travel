import { randomUUID } from "node:crypto";

import type { McpGateway, ToolCallResult } from "../capability/types.js";
import type { AgentContext } from "../context/types.js";
import type { ModuleResponse } from "../model/types.js";
import type { Trace } from "../observability/trace.js";
import type { ModelFactory } from "../model/model-factory.js";
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

const PEO_STAGE_COUNT = 3;

export class PlanPromptBuilder {
  async buildPrompt(context: AgentContext): Promise<Record<string, unknown>> {
    const runtimeContext = getRuntimeContext(context);
    return {
      stage: "plan",
      maxStages: PEO_STAGE_COUNT,
      userInput: runtimeContext.userInput.content,
      availableToolName: typeof runtimeContext.userInput.content.toolName === "string"
        ? runtimeContext.userInput.content.toolName
        : undefined,
    };
  }
}

export class PlanChecker {
  async check(plan: Record<string, unknown>): Promise<Record<string, unknown>> {
    const content = typeof plan.content === "string" ? plan.content : "";
    if (!content.trim()) {
      throw new Error("PEO plan is empty.");
    }
    const parsed = tryParseJsonRecord(content);
    const toolName = typeof parsed?.toolName === "string"
      ? parsed.toolName
      : typeof plan.availableToolName === "string" && contentIncludesToolHint(content, plan.availableToolName)
        ? plan.availableToolName
        : undefined;
    const executionType = normalizeExecutionType(parsed?.executionType, toolName);
    return {
      plan: typeof parsed?.plan === "string" && parsed.plan.trim() ? parsed.plan : content,
      executionType,
      toolName,
      executionPayload: isRecord(parsed?.executionPayload) ? parsed.executionPayload : undefined,
      finalAnswer: typeof parsed?.finalAnswer === "string" ? parsed.finalAnswer : undefined,
    };
  }
}

export class TaskExecutor {
  constructor(private readonly gateway: McpGateway) {}

  async execute(plan: Record<string, unknown>, context: AgentContext): Promise<Record<string, unknown>> {
    const runtimeContext = getRuntimeContext(context);
    if (plan.executionType !== "tool" || typeof plan.toolName !== "string") {
      return {
        toolCalls: 0,
        failedToolCalls: 0,
        executionObservation: String(plan.plan ?? ""),
      };
    }

    const result = await this.gateway.call({
      toolName: plan.toolName,
      payload: isRecord(plan.executionPayload)
        ? plan.executionPayload
        : isRecord(runtimeContext.userInput.content.toolPayload)
          ? runtimeContext.userInput.content.toolPayload
          : {},
      sessionId: runtimeContext.sessionId,
      runId: String(plan.runId ?? ""),
      stepIndex: 2,
      workingDirectory: typeof runtimeContext.userInput.content.workingDirectory === "string"
        ? runtimeContext.userInput.content.workingDirectory
        : undefined,
      allowedWorkingDirectories: runtimeContext.allowedWorkingDirectories,
    });
    return normalizeExecutionResult(result);
  }
}

export class ExecutionResultChecker {
  async check(executionResult: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof executionResult.executionObservation !== "string") {
      throw new Error("PEO execution result is invalid.");
    }
    return executionResult;
  }
}

export class ObservationChecker {
  async check(observation: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof observation.executionObservation !== "string") {
      throw new Error("PEO observation is invalid.");
    }
    return {
      executionObservation: observation.executionObservation,
      finalAnswer: typeof observation.finalAnswer === "string" ? observation.finalAnswer : undefined,
    };
  }
}

export class PEOAgent implements IAgent {
  readonly pattern = "peo" as const;
  private running = false;

  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly planPromptBuilder: PlanPromptBuilder,
    private readonly planChecker: PlanChecker,
    private readonly taskExecutor: TaskExecutor,
    private readonly executionResultChecker: ExecutionResultChecker,
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
      const planPrompt = await this.planPromptBuilder.buildPrompt(context);
      const planResponse = await this.executePlanModel(context, runId, planPrompt);
      const checkedPlan = await this.planChecker.check({
        content: planResponse.content,
        runId,
        availableToolName: getRequestedToolName(context),
      });
      const executionResult = await this.executePlanTask(context, runId, checkedPlan);
      toolCalls += asNumber(executionResult.toolCalls);
      failedToolCalls += asNumber(executionResult.failedToolCalls);
      const checkedExecution = await this.executionResultChecker.check({
        ...executionResult,
        finalAnswer: checkedPlan.finalAnswer,
      });
      const checkedObservation = await this.observationChecker.check(checkedExecution);
      if (checkedPlan.executionType === "tool" && typeof checkedObservation.executionObservation === "string" && checkedObservation.executionObservation) {
        transcriptAppend.push(createToolTranscriptTurn(checkedObservation.executionObservation));
      }
      const observeResponse = await this.executeObserveModel(context, runId, {
        stage: "observe",
        plan: checkedPlan.plan,
        executionObservation: checkedObservation.executionObservation,
        userInput: getRuntimeContext(context).userInput.content,
      });
      transcriptAppend.push(createAssistantTranscriptTurn(observeResponse.content));
      return createPeoSuccessResult(
        this.pattern,
        context,
        runId,
        String(checkedPlan.plan),
        observeResponse.content,
        transcriptAppend,
        toolCalls,
        failedToolCalls,
      );
    } catch (error) {
      return createPeoFailureResult(this.pattern, context, runId, error, toolCalls, failedToolCalls);
    } finally {
      this.running = false;
    }
  }

  private createModel(context: AgentContext) {
    const runtimeContext = getRuntimeContext(context);
    return this.modelFactory.createModel({
      mock: runtimeContext.modelConfig?.mock ?? true,
      modeSelection: runtimeContext.modelConfig?.modeSelection ?? {},
      mockInfo: runtimeContext.modelConfig?.mockInfo,
    });
  }

  private async executePlanModel(
    context: AgentContext,
    runId: string,
    prompt: Record<string, unknown>,
  ): Promise<ModuleResponse> {
    await this.recordModelCalled(context, runId, "peo plan model called");
    const response = await this.createModel(context).execute({
      prompt,
      stream: false,
    });
    await this.recordModelResult(context, runId, "peo plan result recorded");
    ensureSuccessfulModelResponse(response);
    return response;
  }

  private async executeObserveModel(
    context: AgentContext,
    runId: string,
    prompt: Record<string, unknown>,
  ): Promise<ModuleResponse> {
    await this.recordModelCalled(context, runId, "peo observe model called");
    const response = await this.createModel(context).execute({
      prompt,
      stream: false,
    });
    await this.recordModelResult(context, runId, "peo observe result recorded");
    ensureSuccessfulModelResponse(response);
    return response;
  }

  private async executePlanTask(
    context: AgentContext,
    runId: string,
    checkedPlan: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (typeof checkedPlan.toolName === "string" && checkedPlan.executionType === "tool") {
      await this.recordToolCalled(context, runId, checkedPlan.toolName);
    }
    const result = await this.taskExecutor.execute({
      ...checkedPlan,
      runId,
    }, context);
    if (typeof checkedPlan.toolName === "string" && checkedPlan.executionType === "tool") {
      await this.recordToolResult(context, runId, checkedPlan.toolName);
    }
    return result;
  }

  private async recordToolCalled(context: AgentContext, runId: string, toolName: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "tool_called",
      timestamp: new Date().toISOString(),
      caller: "PEOAgent",
      summary: `tool called: ${toolName}`,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
      stepIndex: 2,
    });
  }

  private async recordToolResult(context: AgentContext, runId: string, toolName: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "tool_result_recorded",
      timestamp: new Date().toISOString(),
      caller: "PEOAgent",
      summary: `tool result recorded: ${toolName}`,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
      stepIndex: 2,
    });
  }

  private async recordModelCalled(context: AgentContext, runId: string, summary: string): Promise<void> {
    await this.trace.record({
      traceId: runId,
      scope: "session",
      eventType: "model_called",
      timestamp: new Date().toISOString(),
      caller: "PEOAgent",
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
      caller: "PEOAgent",
      summary,
      sessionId: getRuntimeContext(context).sessionId,
      runId,
    });
  }
}

function createPeoSuccessResult(
  pattern: IAgent["pattern"],
  context: AgentContext,
  runId: string,
  planContent: string,
  observeContent: string,
  transcriptAppend: AgentRuntimeResult["stateUpdate"]["transcriptAppend"],
  toolCalls: number,
  failedToolCalls: number,
): AgentRuntimeResult {
  return {
    runId,
    traceId: runId,
    content: {
      data: observeContent,
      format: "text",
    },
    agent: createAgentMetadata(pattern, context),
    stateUpdate: {
      transcriptAppend,
      runtimeMemorySummaryItems: [
        { summary: `peo:${planContent.slice(0, 64)}` },
      ],
    },
    executionFacts: {
      toolCalls,
      failedToolCalls,
    },
  };
}

function createPeoFailureResult(
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
      code: "PEO_AGENT_FAILED",
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

function normalizeExecutionResult(result: ToolCallResult): Record<string, unknown> {
  return {
    toolCalls: 1,
    failedToolCalls: result.error ? 1 : 0,
    executionObservation: result.error ? result.error.message : result.content,
  };
}

function normalizeExecutionType(candidate: unknown, toolName: string | undefined): "tool" | "respond" {
  if (candidate === "tool" || candidate === "respond") {
    return candidate;
  }
  return toolName ? "tool" : "respond";
}
