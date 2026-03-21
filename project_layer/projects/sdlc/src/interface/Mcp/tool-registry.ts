import type { ExecutionUnitId } from "../../Runtime/Schema/runtime.js";
import type { CapabilityToolArguments, McpToolDefinition } from "./types.js";

type SupportedArgumentKey = keyof CapabilityToolArguments;

export interface RegisteredMcpTool extends McpToolDefinition {
  executionUnitId: ExecutionUnitId;
}

interface RegisteredToolConfig {
  name: string;
  description: string;
  executionUnitId: ExecutionUnitId;
  requiredFields: readonly SupportedArgumentKey[];
  optionalFields: readonly SupportedArgumentKey[];
}

const FIELD_PROPERTIES: Record<SupportedArgumentKey, { type: "string" }> = {
  project_name: { type: "string" },
  user_comment: { type: "string" },
  item_descriptor_path: { type: "string" },
  test_command: { type: "string" },
};

const TOOL_CONFIGS: readonly RegisteredToolConfig[] = [
  registerTool("requirement_design_generate", "Generate requirement design artifact.", "requirement_design_generate", [], ["project_name", "user_comment"]),
  registerTool("architecture_design_generate", "Generate architecture design artifact.", "architecture_design_generate", [], ["project_name", "user_comment"]),
  registerTool("item_design_generate", "Generate item design artifact.", "item_design_generate", ["item_descriptor_path"], ["project_name", "user_comment"]),
  registerTool("work_plan_generate", "Generate work plan artifact.", "work_plan_generate", [], ["project_name", "user_comment"]),
  registerTool("requirement_design_update", "Generate one requirement document update handoff.", "requirement_design_update", ["user_comment"], ["project_name"]),
  registerTool("architecture_design_update", "Generate one architecture document update handoff.", "architecture_design_update", ["user_comment"], ["project_name"]),
  registerTool("item_design_update", "Generate one item design document update handoff.", "item_design_update", ["user_comment", "item_descriptor_path"], ["project_name"]),
  registerTool("work_plan_update", "Generate one work plan document update handoff.", "work_plan_update", [], ["project_name", "user_comment"]),
  registerTool("requirement_design_contract", "Validate requirement design artifact.", "requirement_design_contract", [], ["project_name", "user_comment"]),
  registerTool("architecture_design_contract", "Validate architecture design artifact.", "architecture_design_contract", [], ["project_name", "user_comment"]),
  registerTool("item_design_contract", "Validate item design artifact.", "item_design_contract", [], ["project_name", "user_comment"]),
  registerTool("work_plan_contract", "Validate work plan artifact.", "work_plan_contract", [], ["project_name", "user_comment"]),
  registerTool("overall_design_contract", "Validate cross-document overall design consistency.", "overall_design_contract", [], ["project_name", "user_comment"]),
  registerTool("work_execute", "Generate one workspace change handoff.", "work_execute", [], ["project_name", "user_comment"]),
  registerTool("work_execute_contract", "Validate workspace state with one test command.", "work_execute_contract", ["test_command"], ["project_name", "user_comment"]),
] as const;

export class McpToolRegistryService {
  listTools(): McpToolDefinition[] {
    return TOOL_CONFIGS.map((tool) => this.toToolDefinition(tool));
  }

  getTool(name: string): RegisteredMcpTool {
    const tool = TOOL_CONFIGS.find((entry) => entry.name === name);
    if (!tool) {
      throw new Error(`Unsupported MCP tool: ${name}`);
    }

    return {
      ...this.toToolDefinition(tool),
      executionUnitId: tool.executionUnitId,
    };
  }

  validateArguments(name: string, input: Record<string, unknown>): CapabilityToolArguments {
    const tool = TOOL_CONFIGS.find((entry) => entry.name === name);
    if (!tool) {
      throw new Error(`Unsupported MCP tool: ${name}`);
    }

    const allowedFields = new Set<SupportedArgumentKey>([
      ...tool.requiredFields,
      ...tool.optionalFields,
    ]);
    const result: CapabilityToolArguments = {};

    for (const [key, value] of Object.entries(input)) {
      if (!allowedFields.has(key as SupportedArgumentKey)) {
        throw new Error(`Invalid MCP argument for ${name}: ${key}`);
      }

      if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`Invalid MCP argument for ${name}: ${key} must be a non-empty string.`);
      }

      result[key as SupportedArgumentKey] = value;
    }

    for (const field of tool.requiredFields) {
      if (typeof result[field] !== "string" || result[field]?.trim().length === 0) {
        throw new Error(`Missing required MCP argument for ${name}: ${field}`);
      }
    }

    return result;
  }

  private toToolDefinition(tool: RegisteredToolConfig): McpToolDefinition {
    const properties = Object.fromEntries(
      [...tool.requiredFields, ...tool.optionalFields].map((field) => [field, FIELD_PROPERTIES[field]]),
    );
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties,
        ...(tool.requiredFields.length > 0 ? { required: [...tool.requiredFields] } : {}),
        additionalProperties: false,
      },
    };
  }
}

function registerTool(
  name: string,
  description: string,
  executionUnitId: ExecutionUnitId,
  requiredFields: readonly SupportedArgumentKey[],
  optionalFields: readonly SupportedArgumentKey[],
): RegisteredToolConfig {
  return {
    name,
    description,
    executionUnitId,
    requiredFields,
    optionalFields,
  };
}
