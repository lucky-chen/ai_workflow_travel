import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";

import assert from "node:assert/strict";

import {
  DefaultAgent,
  DefaultExecutor,
  DefaultMcpGateway,
  DefaultObserver,
  DefaultPlanner,
  type AgentContext,
  type IModelExecutionBackend,
} from "../src/runtime/agent-runtime.js";
import type {
  AgentTraceEvent,
  IAgentTraceRecorder,
} from "../src/runtime/agent-trace-recorder.js";

export async function runAgentRuntimeTests(): Promise<void> {
  await testDefaultPlannerBuildsDirectGenerationPlan();
  await testDefaultPlannerBuildsToolAugmentedPlan();
  await testDefaultObserverAcceptsResult();
  await testDefaultExecutorPassesRequestToBackend();
  await testDefaultExecutorRunsMcpToolStepsBeforeBackend();
  await testDefaultAgentRunsSinglePassAndRecordsTrace();
  await testDefaultAgentRecordsToolTrace();
  await testDefaultMcpGatewaySupportsFileReadAndWrite();
  await testAgentTraceRecorderContract();
}

async function testDefaultPlannerBuildsDirectGenerationPlan(): Promise<void> {
  const planner = new DefaultPlanner();
  const context = createAgentContext();

  const plan = await planner.plan(context);

  assert.equal(plan.mode, "direct_generation");
  assert.equal(plan.summary, "Use direct generation for the current request.");
}

async function testDefaultPlannerBuildsToolAugmentedPlan(): Promise<void> {
  const planner = new DefaultPlanner();
  const context = createAgentContext({
    mcpToolCalls: [
      {
        toolName: "file_read",
        arguments: { path: "/tmp/input.txt" },
      },
    ],
  });

  const plan = await planner.plan(context);

  assert.equal(plan.mode, "tool_augmented_generation");
  assert.equal(plan.summary, "Use MCP-backed tool execution before generation.");
  assert.deepEqual(plan.toolSteps, [
    {
      toolName: "file_read",
      arguments: { path: "/tmp/input.txt" },
    },
  ]);
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

async function testDefaultExecutorPassesRequestToBackend(): Promise<void> {
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

async function testDefaultExecutorRunsMcpToolStepsBeforeBackend(): Promise<void> {
  const backend = new TestModelExecutionBackend({
    content: "{\"summary\":\"backend-with-tools\"}",
    responseFormat: "json",
  });
  const gateway = new TestMcpGateway();
  const executor = new DefaultExecutor(backend, gateway);
  const context = createAgentContext({
    mcpToolCalls: [
      {
        toolName: "file_read",
        arguments: { path: "/tmp/input.txt" },
      },
    ],
  });

  const result = await executor.execute(context, {
    mode: "tool_augmented_generation",
    summary: "Use MCP-backed tool execution before generation.",
    toolSteps: [
      {
        toolName: "file_read",
        arguments: { path: "/tmp/input.txt" },
      },
    ],
  });

  assert.equal(gateway.calls.length, 1);
  assert.equal(gateway.calls[0]?.toolName, "file_read");
  assert.equal(result.toolResults?.length, 1);
  assert.equal(backend.requests.length, 1);
  assert.equal(backend.requests[0]?.prompt.userPrompt.includes("MCP tool results:"), true);
  assert.equal(backend.requests[0]?.prompt.userPrompt.includes("tool:file_read"), true);
}

async function testDefaultAgentRunsSinglePassAndRecordsTrace(): Promise<void> {
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
  assert.deepEqual(
    traceRecorder.getEvents().map((entry) => entry.event.eventType),
    [
      "agent_plan_created",
      "agent_execution_started",
      "agent_execution_finished",
      "agent_observation_finished",
    ],
  );
}

async function testDefaultAgentRecordsToolTrace(): Promise<void> {
  const planner = new DefaultPlanner();
  const observer = new DefaultObserver();
  const backend = new TestModelExecutionBackend({
    content: "{\"summary\":\"agent-tool\"}",
    responseFormat: "json",
  });
  const executor = new DefaultExecutor(backend, new TestMcpGateway());
  const traceRecorder = new TestAgentTraceRecorder();
  const agent = new DefaultAgent(planner, executor, observer, traceRecorder);

  const result = await agent.run(createAgentContext({
    mcpToolCalls: [
      {
        toolName: "file_read",
        arguments: { path: "/tmp/input.txt" },
      },
    ],
  }));

  assert.equal(result.plan.mode, "tool_augmented_generation");
  assert.equal(result.toolResults?.length, 1);
  assert.deepEqual(
    traceRecorder.getEvents().map((entry) => entry.event.eventType),
    [
      "agent_plan_created",
      "agent_execution_started",
      "agent_tool_called",
      "agent_tool_result_recorded",
      "agent_execution_finished",
      "agent_observation_finished",
    ],
  );
}

async function testDefaultMcpGatewaySupportsFileReadAndWrite(): Promise<void> {
  const tempRoot = path.join(process.cwd(), "dist", "tmp");
  await mkdir(tempRoot, { recursive: true });
  const workspaceRoot = await mkdtemp(path.join(tempRoot, "agent-runtime-mcp-"));
  const gateway = new DefaultMcpGateway();
  const filePath = path.join(workspaceRoot, "nested", "note.txt");

  try {
    const writeResult = await gateway.call({
      toolName: "file_write",
      arguments: {
        path: filePath,
        content: "hello mcp",
      },
    });
    assert.equal(writeResult.success, true);
    assert.equal(writeResult.metadata?.path, filePath);

    const readResult = await gateway.call({
      toolName: "file_read",
      arguments: {
        path: filePath,
      },
    });
    assert.equal(readResult.success, true);
    assert.equal(readResult.content, "hello mcp");
    assert.equal(await readFile(filePath, "utf8"), "hello mcp");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function createAgentContext(inputPayload: Record<string, unknown> = {}): AgentContext {
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
      ...inputPayload,
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

class TestModelExecutionBackend implements IModelExecutionBackend {
  readonly requests: AgentContext["request"][] = [];

  constructor(private readonly result: {
    content: string;
    responseFormat: "text" | "json";
    metadata?: Record<string, string>;
  }) {}

  async execute(request: AgentContext["request"]) {
    this.requests.push(request);
    return this.result;
  }
}

class TestMcpGateway {
  readonly calls: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];

  async call(request: { toolName: string; arguments: Record<string, unknown> }) {
    this.calls.push(request);
    return {
      toolName: request.toolName,
      success: true,
      content: `tool:${request.toolName}`,
    };
  }
}
