import type {
  ExecutionResult,
  ValidationResult,
} from "../runtime/agent-runtime-types.js";

export class ExecutionResultValidator {
  validate(
    result: ExecutionResult,
    expectedResponseFormat: "text" | "json",
    expectedIntent?: "chat" | "task",
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        issues.push({
          code: "invalid_json_content",
          message: "JSON execution results must be valid JSON.",
          severity: "high" as const,
        });
      }

      if (expectedIntent === "chat" && !hasValidChatJsonAnswer(parsed)) {
        issues.push({
          code: "invalid_chat_json_answer",
          message: "Chat JSON responses must be a JSON object with a string answer field.",
          severity: "high" as const,
        });
      }

      if (expectedIntent === "task" && !hasValidTaskJsonSummary(parsed)) {
        issues.push({
          code: "invalid_task_json_summary",
          message: "Task JSON responses must be a JSON object with a non-empty summary field.",
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

function hasValidChatJsonAnswer(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.answer === "string";
}

function hasValidTaskJsonSummary(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.summary === "string" && value.summary.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
