import type { Trace } from "../observability/trace.js";

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallInput {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  content: string;
  exitCode?: number;
  error?: {
    code: string;
    message: string;
  };
  blockedByPolicy?: boolean;
}

export interface ToolHandler {
  handle(input: ToolCallInput): Promise<ToolCallResult>;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  handler: ToolHandler;
}

export interface ExternalMcpEndpointConfig {
  name?: string;
  url: string;
  headers?: Record<string, string>;
}

export interface McpToolRegistry {
  register(definition: ToolDefinition): void;
  resolve(toolName: string): ToolHandler;
  getDefinition(toolName: string): ToolDefinition | undefined;
  listToolNames(): string[];
  listToolDefinitions(): ToolDefinition[];
}

export interface PermissionCheckInput {
  toolCall: ToolCallInput;
}

export interface PermissionDecision {
  allowed: boolean;
  reasonCode?: string;
  message?: string;
}

export interface RuntimePermissionPolicy {
  evaluate(input: PermissionCheckInput): Promise<PermissionDecision>;
}

export interface ExecutionEnvironment {
  execute(input: ExecutionEnvironmentInput): Promise<ToolCallResult>;
}

export interface ExecutionEnvironmentInput {
  toolCall: ToolCallInput;
  handler: ToolHandler;
}

export interface McpGateway {
  call(input: ToolCallInput): Promise<ToolCallResult>;
  withTrace(trace: Trace): McpGateway;
}
