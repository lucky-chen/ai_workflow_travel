import type {
  ObservationResult,
  ValidationResult,
} from "../runtime/agent-runtime-types.js";

export class ObservationValidator {
  validate(observation: ObservationResult): ValidationResult<ObservationResult> {
    const issues = [];

    if (!observation.summary.trim()) {
      issues.push({
        code: "missing_observation_summary",
        message: "ObservationResult.summary must be non-empty.",
        severity: "high" as const,
      });
    }

    if (observation.accepted === false && (observation.issues?.length ?? 0) === 0) {
      issues.push({
        code: "missing_observation_issues",
        message: "Rejected observations must include at least one issue.",
        severity: "medium" as const,
      });
    }

    if (observation.completed === true && observation.continueReason?.trim()) {
      issues.push({
        code: "invalid_continue_reason",
        message: "Completed observations must not include continueReason.",
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
      value: observation,
    };
  }
}
