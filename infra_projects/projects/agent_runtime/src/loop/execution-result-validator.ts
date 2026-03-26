import type {
  ExecutionResult,
  ValidationResult,
} from "../runtime/agent-runtime-types.js";

export class ExecutionResultValidator {
  validate(
    result: ExecutionResult,
    expectedResponseFormat: "text" | "json",
  ): ValidationResult<ExecutionResult> {
    const issues = [];

    if (!result.content.trim()) {
      issues.push({
        code: "missing_content",
        message: "ExecutionResult.content must be non-empty.",
        severity: "high" as const,
      });
    }

    if (result.responseFormat !== expectedResponseFormat) {
      issues.push({
        code: "response_format_mismatch",
        message: "ExecutionResult.responseFormat must match the requested responseFormat.",
        severity: "high" as const,
      });
    }

    if (result.responseFormat === "json") {
      try {
        JSON.parse(result.content);
      } catch {
        issues.push({
          code: "invalid_json_content",
          message: "JSON execution results must be valid JSON.",
          severity: "high" as const,
        });
      }
    }

    if (issues.length > 0) {
      return {
        ok: false,
        issues,
      };
    }

    return {
      ok: true,
      value: result,
    };
  }
}
