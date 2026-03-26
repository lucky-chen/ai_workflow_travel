import { AgentTraceApi } from "./agent-trace-api.js";
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
  private readonly traceApi: AgentTraceApi;

  constructor(
    private readonly planner: IPlanner,
    private readonly executor: IExecutor,
    private readonly observer: IObserver,
    private readonly traceRecorder?: IAgentTraceRecorder,
  ) {
    this.traceApi = new AgentTraceApi(traceRecorder);
  }

  async run(context: AgentContext): Promise<AgentResult> {
    const runId = getRunId(context);
    const plan = await this.planner.plan(context);
    await this.traceApi.recordPlanCreated(runId, plan);
    await this.traceApi.recordExecutionStarted(runId, plan);
    const executionResult = await this.executor.execute(context, plan);
    await this.traceApi.recordToolResults(runId, executionResult.toolResults);
    await this.traceApi.recordExecutionFinished(runId, executionResult);

    const observation = await this.observer.observe(context, plan, executionResult);
    await this.traceApi.recordObservationFinished(runId, observation);

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
