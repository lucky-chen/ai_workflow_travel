import assert from "node:assert/strict";

import {
  DefaultObserver,
  DefaultPlanner,
  type AgentContext,
} from "../src/agent-runtime.js";
import type {
  AgentTraceEvent,
  IAgentTraceRecorder,
} from "../src/agent-trace-recorder.js";

export async function runAgentRuntimeTests(): Promise<void> {
  await testDefaultPlannerBuildsDirectGenerationPlan();
  await testDefaultObserverAcceptsResult();
  await testAgentTraceRecorderContract();
}

async function testDefaultPlannerBuildsDirectGenerationPlan(): Promise<void> {
  const planner = new DefaultPlanner();
  const context = createAgentContext();

  const plan = await planner.plan(context);

  assert.equal(plan.mode, "direct_generation");
  assert.equal(plan.summary, "Use direct generation for the current request.");
}

async function testDefaultObserverAcceptsResult(): Promise<void> {
  const observer = new DefaultObserver();
  const context = createAgentContext();

  const observation = await observer.observe(
    context,
    {
      mode: "direct_generation",
      summary: "Use direct generation for the current request.",
    },
    {
      result: {
        content: "{\"summary\":\"ok\"}",
        responseFormat: "json",
      },
    },
  );

  assert.equal(observation.accepted, true);
  assert.equal(observation.summary, "Result accepted.");
}

async function testAgentTraceRecorderContract(): Promise<void> {
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

function createAgentContext(): AgentContext {
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

class TestAgentTraceRecorder implements IAgentTraceRecorder {
  private readonly events: Array<{ ref: string; event: AgentTraceEvent }> = [];

  async record(event: AgentTraceEvent): Promise<string> {
    const ref = `agent-trace-${this.events.length + 1}`;
    this.events.push({ ref, event });
    return ref;
  }

  getEvents(): Array<{ ref: string; event: AgentTraceEvent }> {
    return [...this.events];
  }
}
