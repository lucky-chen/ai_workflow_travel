import assert from "node:assert/strict";
import { DefaultAgent, DefaultExecutor, DefaultObserver, DefaultPlanner, } from "../src/agent-runtime.js";
export async function runAgentRuntimeTests() {
    await testDefaultPlannerBuildsDirectGenerationPlan();
    await testDefaultObserverAcceptsResult();
    await testDefaultExecutorPassesRequestToBackend();
    await testDefaultAgentRunsSinglePassAndRecordsTrace();
    await testAgentTraceRecorderContract();
}
async function testDefaultPlannerBuildsDirectGenerationPlan() {
    const planner = new DefaultPlanner();
    const context = createAgentContext();
    const plan = await planner.plan(context);
    assert.equal(plan.mode, "direct_generation");
    assert.equal(plan.summary, "Use direct generation for the current request.");
}
async function testDefaultObserverAcceptsResult() {
    const observer = new DefaultObserver();
    const context = createAgentContext();
    const observation = await observer.observe(context, {
        mode: "direct_generation",
        summary: "Use direct generation for the current request.",
    }, {
        result: {
            content: "{\"summary\":\"ok\"}",
            responseFormat: "json",
        },
    });
    assert.equal(observation.accepted, true);
    assert.equal(observation.summary, "Result accepted.");
}
async function testAgentTraceRecorderContract() {
    const recorder = new TestAgentTraceRecorder();
    const ref = await recorder.record({
        runId: "run-1",
        eventType: "agent_plan_created",
        summary: "Plan created.",
        payload: {
            mode: "direct_generation",
        },
    });
    assert.equal(ref, "agent-trace-1");
    assert.deepEqual(recorder.getEvents(), [
        {
            ref: "agent-trace-1",
            event: {
                runId: "run-1",
                eventType: "agent_plan_created",
                summary: "Plan created.",
                payload: {
                    mode: "direct_generation",
                },
            },
        },
    ]);
}
async function testDefaultExecutorPassesRequestToBackend() {
    const backend = new TestModelExecutionBackend({
        content: "{\"summary\":\"backend\"}",
        responseFormat: "json",
    });
    const executor = new DefaultExecutor(backend);
    const context = createAgentContext();
    const result = await executor.execute(context, {
        mode: "direct_generation",
        summary: "Use direct generation for the current request.",
    });
    assert.equal(result.result.content, "{\"summary\":\"backend\"}");
    assert.equal(backend.requests.length, 1);
    assert.deepEqual(backend.requests[0], context.request);
}
async function testDefaultAgentRunsSinglePassAndRecordsTrace() {
    const planner = new DefaultPlanner();
    const observer = new DefaultObserver();
    const backend = new TestModelExecutionBackend({
        content: "{\"summary\":\"agent\"}",
        responseFormat: "json",
        metadata: {
            requestId: "req-1",
        },
    });
    const executor = new DefaultExecutor(backend);
    const traceRecorder = new TestAgentTraceRecorder();
    const agent = new DefaultAgent(planner, executor, observer, traceRecorder);
    const result = await agent.run(createAgentContext());
    assert.equal(result.result.content, "{\"summary\":\"agent\"}");
    assert.equal(result.plan.mode, "direct_generation");
    assert.equal(result.observation.accepted, true);
    assert.deepEqual(traceRecorder.getEvents().map((entry) => entry.event.eventType), [
        "agent_plan_created",
        "agent_execution_started",
        "agent_execution_finished",
        "agent_observation_finished",
    ]);
}
function createAgentContext() {
    return {
        request: {
            prompt: {
                systemPrompt: "system",
                userPrompt: "user",
            },
            responseFormat: "json",
            metadata: {
                requestId: "req-1",
            },
        },
        inputPayload: {
            target: "implementation",
        },
    };
}
class TestAgentTraceRecorder {
    events = [];
    async record(event) {
        const ref = `agent-trace-${this.events.length + 1}`;
        this.events.push({ ref, event });
        return ref;
    }
    getEvents() {
        return [...this.events];
    }
}
class TestModelExecutionBackend {
    result;
    requests = [];
    constructor(result) {
        this.result = result;
    }
    async execute(request) {
        this.requests.push(request);
        return this.result;
    }
}
