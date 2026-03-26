import { AgentTraceApi } from "./agent-trace-api.js";
import type { IAgentTraceRecorder } from "./agent-trace-recorder.js";
import type {
  AgentContext,
  AgentRuntimeResult,
  IAgent,
  IExecutor,
  IObserver,
  IPlanner,
} from "./agent-runtime-types.js";

export class DefaultAgent implements IAgent {
  private readonly traceApi: AgentTraceApi;

  constructor(
    private readonly planner: IPlanner,
    private readonly executor: IExecutor,
    private readonly observer: IObserver,
    private readonly traceRecorder?: IAgentTraceRecorder,
  ) {
    this.traceApi = new AgentTraceApi(traceRecorder);
  }

  async run(context: AgentContext): Promise<AgentRuntimeResult> {
    const runId = getRunId(context);
    const sessionId = context.runtimeContext.sessionId;
    const plan = await this.planner.plan(context);
    await this.traceApi.recordRunStarted(sessionId, runId);
    await this.traceApi.recordPlanGenerated(sessionId, runId, plan);
    const executionResult = await this.executor.execute(context, plan);
    await this.traceApi.recordToolResults(sessionId, runId, executionResult.toolResults);
    await this.traceApi.recordExecutionFinished(sessionId, runId, executionResult);

    const observation = await this.observer.observe(context, plan, executionResult);
    await this.traceApi.recordObservationFinished(sessionId, runId, observation);
    await this.traceApi.recordRunFinished(sessionId, runId, observation);

    return {
      status: observation.accepted ? "success" : "failed",
      payload: {
        content: executionResult.content,
        responseFormat: executionResult.responseFormat,
        toolResults: executionResult.toolResults,
        accepted: observation.accepted,
        completed: observation.completed,
        summary: observation.summary,
        stopReason: observation.completed ? "completed" : undefined,
        lastStepIndex: plan.stepIndex,
      },
      diagnostics: observation.issues,
    };
  }
}

function getRunId(context: AgentContext): string {
  const requestId = context.request.metadata?.requestId;
  return requestId && requestId.trim().length > 0 ? requestId : "agent-run";
}
