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

export interface McpToolRegistry {
  register(toolName: string, handler: ToolHandler): Promise<void>;
  resolve(toolName: string): Promise<ToolHandler>;
  listToolNames(): Promise<string[]>;
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
}
