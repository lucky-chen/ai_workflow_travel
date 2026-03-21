export interface McpToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface CapabilityToolArguments {
  project_name?: string;
  user_comment?: string;
  item_descriptor_path?: string;
  test_command?: string;
}

export interface McpInputSchema {
  type: "object";
  properties: Record<string, { type: "string" }>;
  required?: string[];
  additionalProperties: false;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpInputSchema;
}

export interface AgentAction {
  actionType: string;
  targetPath: string;
  instructions: string;
}

export interface McpAgentResult {
  status: "success" | "failed";
  message: string;
  files?: Array<{
    path: string;
    role: string;
  }>;
  issues?: Array<{
    severity?: "low" | "medium" | "high";
    message: string;
  }>;
  agentAction?: AgentAction;
}
