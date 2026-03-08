export class DefaultPlanner {
    async plan(_context) {
        return {
            mode: "direct_generation",
            summary: "Use direct generation for the current request.",
        };
    }
}
export class DefaultObserver {
    async observe(_context, _plan, _result) {
        return {
            accepted: true,
            summary: "Result accepted.",
        };
    }
}
export class DefaultExecutor {
    backend;
    constructor(backend) {
        this.backend = backend;
    }
    async execute(context, _plan) {
        const result = await this.backend.execute(context.request);
        return { result };
    }
}
export class DefaultAgent {
    planner;
    executor;
    observer;
    traceRecorder;
    constructor(planner, executor, observer, traceRecorder) {
        this.planner = planner;
        this.executor = executor;
        this.observer = observer;
        this.traceRecorder = traceRecorder;
    }
    async run(context) {
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
            },
        });
        const executionResult = await this.executor.execute(context, plan);
        await this.traceRecorder?.record({
            runId,
            eventType: "agent_execution_finished",
            summary: "Agent execution finished.",
            payload: {
                responseFormat: executionResult.result.responseFormat,
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
        };
    }
}
function getRunId(context) {
    const requestId = context.request.metadata?.requestId;
    return requestId && requestId.trim().length > 0 ? requestId : "agent-run";
}
export function createDefaultAgent(options) {
    const planner = new DefaultPlanner();
    const executor = new DefaultExecutor(options.backend);
    const observer = new DefaultObserver();
    return new DefaultAgent(planner, executor, observer, options.traceRecorder);
}
