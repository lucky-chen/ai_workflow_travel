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
  await testDefaultAgentReturnsValidationFailureForInvalidObservation();
}

async function testDefaultAgentRunsMultipleStepsUntilCompleted(): Promise<void> {
  const backend = new StepAwareModelBackend();
  const agent = new DefaultAgent(
    new DefaultPlanner(backend, new PlanningPromptBuilder()),
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
    new DefaultPlanner(backend, new PlanningPromptBuilder()),
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

class StepAwareModelBackend implements IModelBackend {
  async execute(request: ModelBackendRequest): Promise<ModelBackendResult> {
    if (request.mode === "planning") {
      const stepIndex = Number((request.prompt.userPrompt.stepIndex as number | undefined) ?? 1);
      if (stepIndex >= 2) {
        return {
          content: JSON.stringify({
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
    return {
      content: JSON.stringify({
        summary: stepGoal,
      }),
      responseFormat: request.responseFormat,
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
