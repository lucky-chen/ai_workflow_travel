import { randomUUID } from "node:crypto";

import type { McpGateway } from "../capability/types.js";
import type { ModelFactory } from "../model/types.js";
import type { Trace } from "../observability/trace.js";
import type { AgentRunContext, AgentRuntimeResult, IAgent } from "./types.js";

const REACT_MAX_STEPS = 2;

export class ReActAgent implements IAgent {
  readonly pattern = "react" as const;
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

      const toolName = typeof context.userInput.content.toolName === "string"
        ? context.userInput.content.toolName
        : undefined;

      let observation = "";
      if (toolName) {
        toolCalls += 1;
        await this.trace.record({
          traceId: runId,
          scope: "session",
          eventType: "tool_called",
          timestamp: new Date().toISOString(),
          caller: "ReActAgent",
          summary: `tool called: ${toolName}`,
          sessionId: context.sessionId,
          runId,
          stepIndex: 1,
        });
        const toolResult = await this.gateway.call({
          toolName,
          payload: isRecord(context.userInput.content.toolPayload) ? context.userInput.content.toolPayload : {},
          sessionId: context.sessionId,
          runId,
          stepIndex: 1,
          workingDirectory: typeof context.userInput.content.workingDirectory === "string"
            ? context.userInput.content.workingDirectory
            : undefined,
          allowedWorkingDirectories: context.allowedWorkingDirectories,
        });
        if (toolResult.error) {
          failedToolCalls += 1;
          observation = toolResult.error.message;
        } else {
          observation = toolResult.content;
        }
        transcriptAppend.push({
          role: "tool",
          content: observation,
          timestamp: new Date().toISOString(),
        });
        await this.trace.record({
          traceId: runId,
          scope: "session",
          eventType: "tool_result_recorded",
          timestamp: new Date().toISOString(),
          caller: "ReActAgent",
          summary: `tool result recorded: ${toolName}`,
          sessionId: context.sessionId,
          runId,
          stepIndex: 1,
        });
      }

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
        caller: "ReActAgent",
        summary: "react model called",
        sessionId: context.sessionId,
        runId,
      });
      const response = await model.execute({
        prompt: {
          iterationLimit: REACT_MAX_STEPS,
          transcript: (context.context.boundedContext ?? context.context.originalContext).transcriptContext.turns,
          userInput: context.userInput.content,
          observation,
        },
        stream: false,
      });
      await this.trace.record({
        traceId: runId,
        scope: "session",
        eventType: "model_result_recorded",
        timestamp: new Date().toISOString(),
        caller: "ReActAgent",
        summary: "react model result recorded",
        sessionId: context.sessionId,
        runId,
      });

      if (response.error.code) {
        throw new Error(response.error.message || response.error.code);
      }

      transcriptAppend.push({
        role: "assistant",
        content: response.content,
        timestamp: new Date().toISOString(),
      });

      return {
        runId,
        traceId: runId,
        content: {
          data: response.content,
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
            { summary: `react:${toolName ?? "no-tool"}` },
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
          code: "REACT_AGENT_FAILED",
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
