import { randomUUID } from "node:crypto";

import type { McpGateway } from "../capability/types.js";
import type { ModelFactory } from "../model/types.js";
import type { Trace } from "../observability/trace.js";
import type { AgentRunContext, AgentRuntimeResult, IAgent } from "./types.js";

const PEO_STAGE_COUNT = 3;

export class PEOAgent implements IAgent {
  readonly pattern = "peo" as const;
  private running = false;

  constructor(
    private readonly modelFactory: ModelFactory,
    private readonly gateway: McpGateway,
    private readonly trace: Trace,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async run(context: AgentRunContext): Promise<AgentRuntimeResult> {
    const runId = randomUUID();
    this.running = true;
    let toolCalls = 0;
    let failedToolCalls = 0;
    try {
      const transcriptAppend = [
        { role: "user", content: JSON.stringify(context.userInput.content), timestamp: new Date().toISOString() },
      ] as AgentRuntimeResult["stateUpdate"]["transcriptAppend"];

      const model = this.modelFactory.createModel({
        mock: context.modelConfig?.mock ?? true,
        modeSelection: context.modelConfig?.modeSelection ?? {},
        mockInfo: context.modelConfig?.mockInfo,
      });
      const planResponse = await model.execute({
        prompt: {
          stage: "plan",
          maxStages: PEO_STAGE_COUNT,
          userInput: context.userInput.content,
        },
        stream: false,
      });
      if (planResponse.error.code) {
        throw new Error(planResponse.error.message || planResponse.error.code);
      }

      const toolName = typeof context.userInput.content.toolName === "string"
        ? context.userInput.content.toolName
        : undefined;
      let executionObservation = planResponse.content;
      if (toolName) {
        toolCalls += 1;
        const toolResult = await this.gateway.call({
          toolName,
          payload: isRecord(context.userInput.content.toolPayload) ? context.userInput.content.toolPayload : {},
          sessionId: context.sessionId,
          runId,
          stepIndex: 2,
          workingDirectory: typeof context.userInput.content.workingDirectory === "string"
            ? context.userInput.content.workingDirectory
            : undefined,
          allowedWorkingDirectories: context.allowedWorkingDirectories,
        });
        if (toolResult.error) {
          failedToolCalls += 1;
          executionObservation = toolResult.error.message;
        } else {
          executionObservation = toolResult.content;
        }
        transcriptAppend.push({
          role: "tool",
          content: executionObservation,
          timestamp: new Date().toISOString(),
        });
      }

      const observeResponse = await model.execute({
        prompt: {
          stage: "observe",
          plan: planResponse.content,
          executionObservation,
          userInput: context.userInput.content,
        },
        stream: false,
      });
      if (observeResponse.error.code) {
        throw new Error(observeResponse.error.message || observeResponse.error.code);
      }

      transcriptAppend.push({
        role: "assistant",
        content: observeResponse.content,
        timestamp: new Date().toISOString(),
      });

      return {
        runId,
        traceId: runId,
        content: {
          data: observeResponse.content,
          format: "text",
        },
        agent: {
          prompt: {
            system: [],
            user: context.userInput.content,
          },
          pattern: this.pattern,
        },
        stateUpdate: {
          transcriptAppend,
          runtimeMemorySummaryItems: [
            { summary: `peo:${planResponse.content.slice(0, 64)}` },
          ],
        },
        executionFacts: {
          toolCalls,
          failedToolCalls,
        },
      };
    } catch (error) {
      return {
        runId,
        traceId: runId,
        errorInfo: {
          code: "PEO_AGENT_FAILED",
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
            { role: "user", content: JSON.stringify(context.userInput.content), timestamp: new Date().toISOString() },
          ],
          runtimeMemorySummaryItems: [],
        },
        executionFacts: {
          toolCalls,
          failedToolCalls,
        },
      };
    } finally {
      this.running = false;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
