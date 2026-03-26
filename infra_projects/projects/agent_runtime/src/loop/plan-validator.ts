import type {
  ExecutionPlan,
  ValidationResult,
} from "../runtime/agent-runtime-types.js";

export class PlanValidator {
  validate(plan: ExecutionPlan): ValidationResult<ExecutionPlan> {
    const issues = [];

    if (plan.stepIndex < 1) {
      issues.push({
        code: "invalid_step_index",
        message: "ExecutionPlan.stepIndex must be greater than or equal to 1.",
        severity: "high" as const,
      });
    }

    if (!plan.summary.trim()) {
      issues.push({
        code: "missing_summary",
        message: "ExecutionPlan.summary must be non-empty.",
        severity: "high" as const,
      });
    }

    if (!plan.nextStepGoal.trim()) {
      issues.push({
        code: "missing_next_step_goal",
        message: "ExecutionPlan.nextStepGoal must be non-empty.",
        severity: "high" as const,
      });
    }

    if (plan.mode !== "tool_augmented_generation" && (plan.toolSteps?.length ?? 0) > 0) {
      issues.push({
        code: "invalid_tool_steps",
        message: "toolSteps are only allowed for tool_augmented_generation mode.",
        severity: "high" as const,
      });
    }

    if (plan.completed && (plan.toolSteps?.length ?? 0) > 0) {
      issues.push({
        code: "completed_plan_with_tool_steps",
        message: "Completed plans must not require additional tool steps.",
        severity: "medium" as const,
      });
    }

    if (plan.stopReason === "completed" && plan.completed !== true) {
      issues.push({
        code: "invalid_stop_reason",
        message: "stopReason 'completed' requires completed=true.",
        severity: "medium" as const,
      });
    }

    if (issues.length > 0) {
      return {
        ok: false,
        issues,
      };
    }

    return {
      ok: true,
      value: plan,
    };
  }
}
