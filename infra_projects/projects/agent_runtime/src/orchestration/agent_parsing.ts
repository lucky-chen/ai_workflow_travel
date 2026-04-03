import type { ToolDefinition } from "../capability/types.js";
import type { ModuleResponse } from "../model/types.js";

export function ensureSuccessfulModelResponse(response: ModuleResponse): void {
  if (response.error.code) {
    throw new Error(response.error.message || response.error.code);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function tryParseJsonRecord(content: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function contentIncludesToolHint(content: string, toolName: string): boolean {
  const normalizedContent = content.toLowerCase();
  return normalizedContent.includes(`[tool:${toolName.toLowerCase()}]`)
    || normalizedContent.includes(`use ${toolName.toLowerCase()}`)
    || normalizedContent.includes(toolName.toLowerCase());
}

export function matchAvailableToolName(content: string, availableTools: string[]): string | undefined {
  for (const toolName of availableTools) {
    if (contentIncludesToolHint(content, toolName)) {
      return toolName;
    }
  }
  return undefined;
}

export function summarizeToolDefinitions(toolDefinitions: ToolDefinition[]): Array<Record<string, unknown>> {
  return toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: summarizeSchema(tool.inputSchema),
    outputSchema: summarizeSchema(tool.outputSchema),
  }));
}

export function createToolUsageRules(
  promptType: "react" | "peo",
): string[] {
  const baseRules = [
    "Select a tool only from availableTools.name.",
    "Arguments must satisfy the selected tool inputSchema.",
    "All required fields in inputSchema.required must be present.",
    "Use only argument names defined in inputSchema.properties.",
  ];
  if (promptType === "peo") {
    return baseRules.concat(
      "If required arguments are missing, do not output toolCall; explain the missing information in plan.",
    );
  }
  return baseRules;
}

function truncatePreview(value: string, maxLength = 240): string {
  if (!value) {
    return "";
  }
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function summarizeSchema(schema: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!schema) {
    return undefined;
  }
  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  const summarizedProperties = properties
    ? Object.fromEntries(
      Object.entries(properties).slice(0, 12).map(([key, value]) => {
        const property = isRecord(value) ? value : {};
        return [
          key,
          omitUndefined({
            type: property.type,
            description: typeof property.description === "string"
              ? truncatePreview(property.description, 120)
              : undefined,
          }),
        ];
      }),
    )
    : undefined;
  return omitUndefined({
    type: schema.type,
    required: Array.isArray(schema.required) ? schema.required : undefined,
    properties: summarizedProperties,
  });
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
