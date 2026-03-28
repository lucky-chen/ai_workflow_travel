export interface ToolCallInput {
  toolName: string;
  payload: Record<string, unknown>;
  sessionId: string;
  runId: string;
  stepIndex?: number;
  workingDirectory?: string;
  allowedWorkingDirectories?: string[];
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
  allowedWorkingDirectories?: string[];
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
  execute(toolCall: ToolCallInput, handler: ToolHandler): Promise<ToolCallResult>;
}

export interface McpGateway {
  call(input: ToolCallInput): Promise<ToolCallResult>;
}
