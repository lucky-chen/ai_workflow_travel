import type { McpToolRegistry, ToolDefinition } from "../capability/types.js";

export interface ToolArgumentValidationResult {
  valid: boolean;
  errors: string[];
  definition?: ToolDefinition;
}

export async function validateToolCallArguments(input: {
  toolRegistry: McpToolRegistry;
  toolName: string;
  arguments: Record<string, unknown>;
}): Promise<ToolArgumentValidationResult> {
  const definition = await input.toolRegistry.getDefinition(input.toolName);
  if (!definition?.inputSchema) {
    return {
      valid: true,
      errors: [],
      definition,
    };
  }
  const errors = validateAgainstSchema(definition.inputSchema, input.arguments);
  return {
    valid: errors.length === 0,
    errors,
    definition,
  };
}

function validateAgainstSchema(schema: Record<string, unknown>, argumentsValue: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (schema.type && schema.type !== "object") {
    return errors;
  }

  const requiredFields = Array.isArray(schema.required)
    ? schema.required.filter((value): value is string => typeof value === "string")
    : [];
  for (const field of requiredFields) {
    if (!(field in argumentsValue)) {
      errors.push(`Missing required argument "${field}".`);
    }
  }

  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  if (!properties) {
    return errors;
  }

  for (const key of Object.keys(argumentsValue)) {
    if (!(key in properties)) {
      errors.push(`Unknown argument "${key}".`);
      continue;
    }
    const propertySchema = isRecord(properties[key]) ? properties[key] : undefined;
    if (!propertySchema?.type) {
      continue;
    }
    if (!matchesPrimitiveType(argumentsValue[key], propertySchema.type)) {
      errors.push(`Argument "${key}" must be of type ${String(propertySchema.type)}.`);
    }
  }

  return errors;
}

function matchesPrimitiveType(value: unknown, expectedType: unknown): boolean {
  if (expectedType === "string") {
    return typeof value === "string";
  }
  if (expectedType === "number") {
    return typeof value === "number";
  }
  if (expectedType === "integer") {
    return typeof value === "number" && Number.isInteger(value);
  }
  if (expectedType === "boolean") {
    return typeof value === "boolean";
  }
  if (expectedType === "object") {
    return isRecord(value);
  }
  if (expectedType === "array") {
    return Array.isArray(value);
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
