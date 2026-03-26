import assert from "node:assert/strict";

import { PlanningPromptBuilder } from "../src/loop/planning-prompt-builder.js";
import { PlanValidator } from "../src/loop/plan-validator.js";
import { DefaultPlanner } from "../src/runtime/default-planner.js";
import type {
  AgentContext,
  IModelBackend,
  ModelBackendRequest,
  ModelBackendResult,
} from "../src/runtime/agent-runtime.js";

export async function runPlanningFlowTests(): Promise<void> {
  await testPlanningPromptBuilderBuildsPlanningRequest();
  await testDefaultPlannerUsesModelBackendForPlanGeneration();
  await testDefaultPlannerParsesExecutionPlanStepsShape();
  await testPlanValidatorRejectsInvalidToolSteps();
}

async function testPlanningPromptBuilderBuildsPlanningRequest(): Promise<void> {
  const builder = new PlanningPromptBuilder();
  const request = builder.build({
    context: createAgentContext(),
  });

  assert.equal(request.mode, "planning");
  assert.equal(request.responseFormat, "json");
  assert.equal(request.prompt.systemPrompt[0], "You are the planning component inside AgentRuntime.");
  assert.equal(request.prompt.systemPrompt.includes("Only return an ExecutionPlan object."), true);
  assert.equal(request.prompt.systemPrompt.includes("Do not add fields outside the ExecutionPlan contract."), true);
  assert.equal(request.prompt.systemPrompt.includes("Do not answer the user task directly."), true);
  assert.equal(request.prompt.systemPrompt.includes("Use intent='chat' when the user can be answered directly from current context."), true);
  assert.deepEqual(request.prompt.userPrompt.originalTask, { task: "plan" });
  assert.equal(request.prompt.userPrompt.responseFormat, "json");
}

async function testDefaultPlannerUsesModelBackendForPlanGeneration(): Promise<void> {
  const backend = new TestModelBackend({
    content: JSON.stringify({
      intent: "chat",
      mode: "direct_generation",
      summary: "Use direct generation.",
      stepIndex: 1,
      nextStepGoal: "Generate output.",
    }),
    responseFormat: "json",
  });
  const planner = new DefaultPlanner(backend);

  const plan = await planner.plan(createAgentContext());

  assert.equal(backend.requests.length, 1);
  assert.equal(plan.intent, "chat");
  assert.equal(plan.mode, "direct_generation");
  assert.equal(plan.nextStepGoal, "Generate output.");
}

async function testDefaultPlannerParsesExecutionPlanStepsShape(): Promise<void> {
  const backend = new TestModelBackend({
    content: JSON.stringify({
      executionPlan: {
        steps: [
          {
            action: "sendResponse",
            parameters: {
              body: {
                ok: true,
              },
            },
          },
        ],
      },
    }),
    responseFormat: "json",
  });
  const planner = new DefaultPlanner(backend);

  const plan = await planner.plan(createAgentContext());

  assert.equal(plan.intent, "chat");
  assert.equal(plan.mode, "direct_generation");
  assert.equal(plan.completed, true);
  assert.equal(plan.stopReason, "completed");
  assert.equal(plan.nextStepGoal, "Generate final response.");
}

async function testPlanValidatorRejectsInvalidToolSteps(): Promise<void> {
  const validator = new PlanValidator();

  const validation = validator.validate({
    intent: "task",
    mode: "direct_generation",
    summary: "invalid",
    stepIndex: 1,
    nextStepGoal: "Generate output.",
    toolSteps: [
      {
        toolName: "file_read",
        arguments: {},
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.issues?.[0]?.code, "invalid_tool_steps");
}

class TestModelBackend implements IModelBackend {
  readonly requests: ModelBackendRequest[] = [];

  constructor(private readonly result: ModelBackendResult) {}

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    this.requests.push(request);
    return this.result;
  }
}

function createAgentContext(): AgentContext {
  return {
    request: {
      prompt: {
        systemPrompt: ["caller system prompt"],
        userPrompt: {
          task: "plan",
        },
      },
      responseFormat: "json",
    },
    runtimeContext: {
      sessionId: "session-1",
      workdir: "/tmp/agent-runtime",
      history: [],
      memory: [],
      retrievalContext: [],
      mcpToolCalls: [],
    },
  };
}
