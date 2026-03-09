import type { IAgentTraceRecorder } from "./agent-trace-recorder.js";
import type {
  AgentContext,
  AgentResult,
  IAgent,
  IExecutor,
  IObserver,
  IPlanner,
} from "./agent-runtime-types.js";

export class DefaultAgent implements IAgent {
  constructor(
    private readonly planner: IPlanner,
    private readonly executor: IExecutor,
    private readonly observer: IObserver,
    private readonly traceRecorder?: IAgentTraceRecorder,
  ) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const runId = getRunId(context);
    const plan = await this.planner.plan(context);
    await this.traceRecorder?.record({
      runId,
      eventType: "agent_plan_created",
      summary: "Agent plan created.",
      payload: {
        mode: plan.mode,
      },
    });

    await this.traceRecorder?.record({
      runId,
      eventType: "agent_execution_started",
      summary: "Agent execution started.",
      payload: {
        mode: plan.mode,
        toolStepCount: String(plan.toolSteps?.length ?? 0),
      },
    });
    const executionResult = await this.executor.execute(context, plan);
    for (const toolResult of executionResult.toolResults ?? []) {
      await this.traceRecorder?.record({
        runId,
        eventType: "agent_tool_called",
        summary: `Agent tool called: ${toolResult.toolName}.`,
        payload: {
          toolName: toolResult.toolName,
          success: String(toolResult.success),
        },
      });
      await this.traceRecorder?.record({
        runId,
        eventType: "agent_tool_result_recorded",
        summary: `Agent tool result recorded: ${toolResult.toolName}.`,
        payload: {
          toolName: toolResult.toolName,
          success: String(toolResult.success),
        },
      });
    }
    await this.traceRecorder?.record({
      runId,
      eventType: "agent_execution_finished",
      summary: "Agent execution finished.",
      payload: {
        responseFormat: executionResult.result.responseFormat,
        toolResultCount: String(executionResult.toolResults?.length ?? 0),
      },
    });

    const observation = await this.observer.observe(context, plan, executionResult);
    await this.traceRecorder?.record({
      runId,
      eventType: "agent_observation_finished",
      summary: "Agent observation finished.",
      payload: {
        accepted: observation.accepted,
      },
    });

    return {
      result: executionResult.result,
      plan,
      observation,
      ...(executionResult.toolResults ? { toolResults: executionResult.toolResults } : {}),
    };
  }
}

function getRunId(context: AgentContext): string {
  const requestId = context.request.metadata?.requestId;
  return requestId && requestId.trim().length > 0 ? requestId : "agent-run";
}
