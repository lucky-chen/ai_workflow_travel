import assert from "node:assert/strict";

import { ExecutionResultValidator } from "../src/loop/execution-result-validator.js";
import { ObservationValidator } from "../src/loop/observation-validator.js";
import { PlanValidator } from "../src/loop/plan-validator.js";
import { ExecutionPromptBuilder } from "../src/loop/execution-prompt-builder.js";
import { PlanningPromptBuilder } from "../src/loop/planning-prompt-builder.js";
import { DefaultAgent } from "../src/runtime/default-agent.js";
import { DefaultExecutor } from "../src/runtime/default-executor.js";
import { DefaultObserver } from "../src/runtime/default-observer.js";
import { DefaultPlanner } from "../src/runtime/default-planner.js";
import type {
  AgentContext,
  IModelBackend,
  ModelBackendRequest,
  ModelBackendResult,
  ObservationResult,
} from "../src/runtime/agent-runtime.js";

export async function runAgentLoopTests(): Promise<void> {
  await testDefaultAgentRunsMultipleStepsUntilCompleted();
  await testDefaultAgentRepairsInvalidPlanByRetryingPlanner();
  await testDefaultAgentRepairsExecutionResultLocally();
  await testDefaultAgentWrapsChatJsonTextIntoAnswerObject();
  await testDefaultAgentRejectsUnsupportedToolNameInPlan();
  await testDefaultAgentReturnsValidationFailureForInvalidPlan();
  await testDefaultAgentReturnsValidationFailureForInvalidExecutionResult();
  await testDefaultAgentReturnsValidationFailureForInvalidObservation();
}

async function testDefaultAgentRunsMultipleStepsUntilCompleted(): Promise<void> {
  const backend = new StepAwareModelBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "success");
  assert.equal(result.payload.lastStepIndex, 2);
  assert.equal(result.payload.stopReason, "completed");
}

async function testDefaultAgentReturnsValidationFailureForInvalidObservation(): Promise<void> {
  const backend = new StepAwareModelBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new InvalidObservationObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.[0]?.code, "missing_observation_issues");
}

async function testDefaultAgentRepairsInvalidPlanByRetryingPlanner(): Promise<void> {
  const backend = new RepairablePlanBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "success");
  assert.equal(backend.planCalls, 2);
}

async function testDefaultAgentRepairsExecutionResultLocally(): Promise<void> {
  const backend = new RepairableExecutionBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "success");
  assert.equal(result.payload.content, "{\"answer\":\"ok\"}");
}

async function testDefaultAgentWrapsChatJsonTextIntoAnswerObject(): Promise<void> {
  const backend = new PlainTextChatExecutionBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "success");
  assert.equal(result.payload.content, "{\"answer\":\"plain chat answer\"}");
}

async function testDefaultAgentRejectsUnsupportedToolNameInPlan(): Promise<void> {
  const backend = new UnsupportedToolPlanBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, ["file_read", "file_write"], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.some((issue) => issue.code === "unsupported_tool_name"), true);
}

async function testDefaultAgentReturnsValidationFailureForInvalidPlan(): Promise<void> {
  const backend = new InvalidPlanBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.[0]?.code, "missing_summary");
}

async function testDefaultAgentReturnsValidationFailureForInvalidExecutionResult(): Promise<void> {
  const backend = new InvalidExecutionBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, [], new PlanningPromptBuilder()),
    new PlanValidator(),
    new DefaultExecutor(backend, undefined, new ExecutionPromptBuilder()),
    new ExecutionResultValidator(),
    new DefaultObserver(),
    new ObservationValidator(),
  );

  const result = await agent.run(createAgentContext());

  assert.equal(result.status, "failed");
  assert.equal(result.diagnostics?.[0]?.code, "invalid_json_content");
}

class StepAwareModelBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      const stepIndex = Number((request.prompt.userPrompt.stepIndex as number | undefined) ?? 1);
      if (stepIndex >= 2) {
        return {
          content: JSON.stringify({
            intent: "chat",
            mode: "direct_generation",
            summary: "Complete on step two.",
            stepIndex,
            nextStepGoal: "Finish generation.",
            completed: true,
            stopReason: "completed",
          }),
          responseFormat: "json",
        };
      }

      return {
        content: JSON.stringify({
          intent: "task",
          mode: "direct_generation",
          summary: "Continue to next step.",
          stepIndex,
          nextStepGoal: "Generate partial output.",
          completed: false,
        }),
        responseFormat: "json",
      };
    }

    const stepGoal = String(request.prompt.userPrompt.nextStepGoal ?? "");
    if (request.prompt.userPrompt.intent === "chat") {
      return {
        content: JSON.stringify({
          answer: stepGoal,
        }),
        responseFormat: request.responseFormat,
      };
    }
    return {
      content: JSON.stringify({
        summary: stepGoal,
      }),
      responseFormat: request.responseFormat,
    };
  }
}

class InvalidPlanBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      return {
        content: JSON.stringify({
          intent: "chat",
          mode: "direct_generation",
          summary: "",
          stepIndex: 1,
          nextStepGoal: "Generate output.",
        }),
        responseFormat: "json",
      };
    }

    return {
      content: "{\"summary\":\"unused\"}",
      responseFormat: request.responseFormat,
    };
  }
}

class RepairablePlanBackend implements IModelBackend {
  planCalls = 0;

  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      this.planCalls += 1;
      if (this.planCalls === 1) {
        return {
          content: JSON.stringify({
            intent: "chat",
            mode: "direct_generation",
            summary: "",
            stepIndex: 1,
            nextStepGoal: "",
          }),
          responseFormat: "json",
        };
      }

      return {
        content: JSON.stringify({
          intent: "chat",
          mode: "direct_generation",
          summary: "Repaired plan.",
          stepIndex: 1,
          nextStepGoal: "Generate output.",
        }),
        responseFormat: "json",
      };
    }

    return {
      content: "{\"answer\":\"ok\"}",
      responseFormat: request.responseFormat,
    };
  }
}

class RepairableExecutionBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      return {
        content: JSON.stringify({
          intent: "chat",
          mode: "direct_generation",
          summary: "Valid plan.",
          stepIndex: 1,
          nextStepGoal: "Generate output.",
          completed: true,
          stopReason: "completed",
        }),
        responseFormat: "json",
      };
    }

    return {
      content: "```json\n{\"answer\":\"ok\"}\n```",
      responseFormat: "json",
    };
  }
}

class PlainTextChatExecutionBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      return {
        content: JSON.stringify({
          intent: "chat",
          mode: "direct_generation",
          summary: "Valid plan.",
          stepIndex: 1,
          nextStepGoal: "Generate output.",
          completed: true,
          stopReason: "completed",
        }),
        responseFormat: "json",
      };
    }

    return {
      content: "plain chat answer",
      responseFormat: "json",
    };
  }
}

class UnsupportedToolPlanBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      return {
        content: JSON.stringify({
          intent: "task",
          mode: "tool_augmented_generation",
          summary: "Use unsupported tool.",
          stepIndex: 1,
          nextStepGoal: "Continue with unsupported tool.",
          toolSteps: [
            {
              toolName: "processInput",
              arguments: {},
            },
          ],
        }),
        responseFormat: "json",
      };
    }

    return {
      content: "{\"summary\":\"unused\"}",
      responseFormat: request.responseFormat,
    };
  }
}

class InvalidExecutionBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      return {
        content: JSON.stringify({
          intent: "task",
          mode: "direct_generation",
          summary: "Valid plan.",
          stepIndex: 1,
          nextStepGoal: "Generate output.",
        }),
        responseFormat: "json",
      };
    }

    return {
      content: "not-json",
      responseFormat: "json",
    };
  }
}

class InvalidObservationObserver extends DefaultObserver {
  override async observe(): Promise<ObservationResult> {
    return {
      accepted: false,
      summary: "Rejected without issues.",
      completed: false,
    };
  }
}

function createAgentContext(): AgentContext {
  return {
    request: {
      prompt: {
        systemPrompt: ["caller system prompt"],
        userPrompt: {
          task: "loop",
        },
      },
      responseFormat: "json",
      metadata: {
        requestId: "run-loop",
      },
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
