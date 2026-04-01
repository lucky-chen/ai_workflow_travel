export type RuntimeEventType =
  | "session_create_requested"
  | "session_created"
  | "session_open_requested"
  | "session_opened"
  | "session_closed"
  | "external_mcp_registered"
  | "run_started"
  | "context_assembled"
  | "agent_selected"
  | "state_persisted"
  | "model_started"
  | "model_completed"
  | "task_selected"
  | "task_completed"
  | "tool_started"
  | "tool_completed"
  | "run_finished"
  | "run_failed";

export interface RuntimeEvent {
  type: RuntimeEventType;
  metadata: {
    timestamp: string;
    sessionId?: string;
    traceId?: string;
  };
  session?: {
    mode?: "create" | "open" | "close";
  };
  agent?: {
    name: "chat" | "react" | "peo";
    chat?: {
      stage: "chat";
    };
    react?: {
      step: "thought" | "action" | "observation";
      stepIndex: number;
      actionType?: "tool" | "respond";
    };
    peo?: {
      step: "plan" | "task_execution" | "observation";
      stepIndex: number;
      taskId?: string;
      taskType?: "direct" | "react";
      taskStatus?: "pending" | "completed" | "failed" | "blocked";
      taskCount?: number;
    };
    tool?: {
      toolName: string;
      arguments?: Record<string, unknown>;
      error?: {
        code: string;
        message: string;
      };
    };
  };
  custom?: Record<string, unknown>;
}

export interface RuntimeEventCallback {
  onEvent(event: RuntimeEvent): Promise<void> | void;
}
