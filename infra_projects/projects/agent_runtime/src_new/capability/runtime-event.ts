export type RuntimeEvent =
  | {
    type: "runtime";
    runtimeMessage: RuntimeMessage;
  }
  | {
    type: "agent";
    agentMessage: AgentMessage;
  }
  | {
    type: "model";
    modelMessage: ModelMessage;
  }
  | {
    type: "tool";
    toolMessage: ToolMessage;
  };

export interface RuntimeMessage {
  event:
    | "session_create_requested"
    | "session_created"
    | "session_open_requested"
    | "session_opened"
    | "session_closed"
    | "external_mcp_registered"
    | "run_started"
    | "context_assembled"
    | "state_persisted"
    | "run_finished"
    | "run_failed";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  session?: {
    mode?: "create" | "open" | "close";
  };
  custom?: Record<string, unknown>;
}

export interface AgentMessage {
  event: "agent_selected" | "agent_step_completed" | "task_selected" | "task_completed";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  agent: AgentEventAgent;
  custom?: Record<string, unknown>;
}

export interface ModelMessage {
  event: "model_started" | "model_completed";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  agent?: AgentEventAgent;
  request?: {
    responseFormat: "text" | "json";
    userPrompt: Record<string, unknown>;
    stream: boolean;
    systemPromptCount: number;
  };
  response?: {
    content: string;
    error: {
      code: string;
      message: string;
    };
  };
}

export interface ToolMessage {
  event: "tool_started" | "tool_failed";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  agent: AgentEventAgent;
  tool: {
    toolName: string;
    arguments?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
    };
    result?: {
      content: string;
      exitCode?: number;
      blockedByPolicy?: boolean;
    };
  };
  custom?: Record<string, unknown>;
}

export interface AgentEventAgent {
  name: "chat" | "react" | "peo";
  chat?: {
    stage: "chat";
    result?: {
      finalAnswer: string;
    };
  };
  react?: {
    step: "thought" | "action" | "observation";
    stepIndex: number;
    actionType?: "tool" | "respond";
    thoughtResult?: {
      toolName?: string;
      actionPayload?: Record<string, unknown>;
      finalAnswer?: string;
    };
    observationResult?: {
      summary: string;
      completed: boolean;
      finalAnswer: string;
    };
  };
  peo?: {
    step: "plan" | "task_execution" | "observation";
    stepIndex: number;
    taskId?: string;
    taskType?: "direct" | "react";
    taskStatus?: "pending" | "completed" | "failed" | "blocked";
    taskCount?: number;
    planResult?: {
      planSummary: string;
      tasks: Array<{
        taskId: string;
        description: string;
        type: "direct" | "react";
        status: "pending" | "completed" | "failed" | "blocked";
        dependsOn?: string[];
      }>;
      finalAnswer?: string;
    };
    observationResult?: {
      summary: string;
      completed: boolean;
      finalAnswer: string;
    };
    taskResult?: {
      taskId: string;
      taskStatus: "completed" | "failed" | "blocked";
      output?: string;
      error?: {
        code: string;
        message: string;
      };
    };
  };
}

export interface RuntimeEventCallback {
  onEvent(event: RuntimeEvent): Promise<void> | void;
}
